using System.Diagnostics;
using System.Net;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Netracer.ServiceHost;

public sealed class NetracerSupervisor : BackgroundService
{
  private readonly ILogger<NetracerSupervisor> _logger;
  private readonly HttpClient _httpClient;
  private readonly NetracerSupervisorOptions _options;
  private readonly ServiceLog _supervisorLog;
  private readonly ServiceLog _childLog;
  private readonly WindowsJobObject _jobObject;
  private readonly object _sync = new();

  private Process? _child;
  private DateTimeOffset _childStartedAt = DateTimeOffset.MinValue;
  private int _consecutiveHealthFailures;

  public NetracerSupervisor(
    IOptions<NetracerSupervisorOptions> options,
    ILogger<NetracerSupervisor> logger,
    HttpClient httpClient)
  {
    _options = options.Value;
    _options.ApplyDefaults();
    _options.Validate();

    _logger = logger;
    _httpClient = httpClient;
    _httpClient.Timeout = Timeout.InfiniteTimeSpan;

    Directory.CreateDirectory(_options.LogDirectory);
    _supervisorLog = new ServiceLog(Path.Combine(_options.LogDirectory, "watchdog.log"));
    _childLog = new ServiceLog(Path.Combine(_options.LogDirectory, "netracer-child.log"));
    _jobObject = WindowsJobObject.CreateKillOnClose();
  }

  public override async Task StartAsync(CancellationToken cancellationToken)
  {
    LogSupervisor($"starting watchdog repoRoot={_options.RepoRoot} nodePath={_options.NodePath} port={_options.Port} healthUrl={_options.HealthUrl}");
    await base.StartAsync(cancellationToken);
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        if (!IsChildRunning())
        {
          await StartChildAsync(stoppingToken);
        }
        else
        {
          await ProbeAndRecycleIfNeededAsync(stoppingToken);
        }
      }
      catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
      {
        break;
      }
      catch (Exception error)
      {
        LogSupervisor($"watchdog loop error: {error.Message}");
      }

      try
      {
        await Task.Delay(TimeSpan.FromSeconds(_options.PollIntervalSeconds), stoppingToken);
      }
      catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
      {
        break;
      }
    }
  }

  public override async Task StopAsync(CancellationToken cancellationToken)
  {
    LogSupervisor("stopping watchdog");
    await StopChildAsync("service-stop", cancellationToken);
    await base.StopAsync(cancellationToken);
    _jobObject.Dispose();
    _childLog.Dispose();
    _supervisorLog.Dispose();
  }

  private async Task ProbeAndRecycleIfNeededAsync(CancellationToken stoppingToken)
  {
    var childAge = DateTimeOffset.UtcNow - _childStartedAt;
    if (childAge < TimeSpan.FromSeconds(_options.StartupGraceSeconds))
    {
      return;
    }

    using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
    cts.CancelAfter(TimeSpan.FromSeconds(_options.HealthTimeoutSeconds));

    try
    {
      using var response = await _httpClient.GetAsync(_options.HealthUrl, cts.Token);
      if (response.StatusCode == HttpStatusCode.OK)
      {
        if (_consecutiveHealthFailures > 0)
        {
          LogSupervisor("health recovered");
        }
        _consecutiveHealthFailures = 0;
        return;
      }

      _consecutiveHealthFailures += 1;
      LogSupervisor($"health failed status={(int)response.StatusCode} consecutive={_consecutiveHealthFailures}");
    }
    catch (Exception error) when (!stoppingToken.IsCancellationRequested)
    {
      _consecutiveHealthFailures += 1;
      LogSupervisor($"health probe error={error.Message} consecutive={_consecutiveHealthFailures}");
    }

    if (_consecutiveHealthFailures < _options.UnhealthyThreshold)
    {
      return;
    }

    await RecycleChildAsync($"health-threshold-{_consecutiveHealthFailures}", stoppingToken);
  }

  private async Task RecycleChildAsync(string reason, CancellationToken stoppingToken)
  {
    LogSupervisor($"recycling child reason={reason}");
    await StopChildAsync(reason, stoppingToken);
    _consecutiveHealthFailures = 0;

    if (!stoppingToken.IsCancellationRequested)
    {
      await Task.Delay(TimeSpan.FromSeconds(_options.RestartDelaySeconds), stoppingToken);
      await StartChildAsync(stoppingToken);
    }
  }

  private async Task StartChildAsync(CancellationToken stoppingToken)
  {
    lock (_sync)
    {
      if (IsChildRunning())
      {
        return;
      }
    }

    var startInfo = new ProcessStartInfo
    {
      FileName = _options.NodePath,
      Arguments = _options.ChildArguments,
      WorkingDirectory = _options.RepoRoot,
      UseShellExecute = false,
      RedirectStandardOutput = true,
      RedirectStandardError = true,
      CreateNoWindow = true
    };

    startInfo.Environment["PORT"] = _options.Port.ToString();
    startInfo.Environment["HOST"] = _options.Host;
    startInfo.Environment["DATA_DIR"] = _options.DataDir;

    var process = new Process
    {
      StartInfo = startInfo,
      EnableRaisingEvents = true
    };

    process.OutputDataReceived += (_, args) =>
    {
      if (!string.IsNullOrWhiteSpace(args.Data))
      {
        _childLog.Write("stdout", args.Data);
      }
    };
    process.ErrorDataReceived += (_, args) =>
    {
      if (!string.IsNullOrWhiteSpace(args.Data))
      {
        _childLog.Write("stderr", args.Data);
      }
    };
    process.Exited += (_, _) =>
    {
      LogSupervisor($"child exited pid={process.Id} exitCode={SafeExitCode(process)}");
    };

    if (!process.Start())
    {
      throw new InvalidOperationException("netracer child failed to start");
    }

    _jobObject.Assign(process);

    process.BeginOutputReadLine();
    process.BeginErrorReadLine();

    lock (_sync)
    {
      _child = process;
      _childStartedAt = DateTimeOffset.UtcNow;
      _consecutiveHealthFailures = 0;
    }

    LogSupervisor($"child started pid={process.Id}");

    if (!stoppingToken.IsCancellationRequested)
    {
      await Task.Delay(TimeSpan.FromSeconds(Math.Min(2, _options.RestartDelaySeconds)), stoppingToken);
    }
  }

  private async Task StopChildAsync(string reason, CancellationToken cancellationToken)
  {
    Process? process;
    lock (_sync)
    {
      process = _child;
      _child = null;
      _childStartedAt = DateTimeOffset.MinValue;
    }

    if (process is null)
    {
      return;
    }

    try
    {
      if (process.HasExited)
      {
        process.Dispose();
        return;
      }

      LogSupervisor($"stopping child pid={process.Id} reason={reason}");

      try
      {
        process.Kill(entireProcessTree: true);
      }
      catch (InvalidOperationException)
      {
      }

      using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
      cts.CancelAfter(TimeSpan.FromSeconds(_options.StopTimeoutSeconds));
      try
      {
        await process.WaitForExitAsync(cts.Token);
      }
      catch (OperationCanceledException)
      {
        if (!process.HasExited)
        {
          try
          {
            process.Kill(entireProcessTree: true);
          }
          catch (InvalidOperationException)
          {
          }
        }
      }
    }
    finally
    {
      process.Dispose();
    }
  }

  private bool IsChildRunning()
  {
    lock (_sync)
    {
      return _child is { HasExited: false };
    }
  }

  private void LogSupervisor(string message)
  {
    _logger.LogInformation("{Message}", message);
    _supervisorLog.Write("watchdog", message);
  }

  private static int SafeExitCode(Process process)
  {
    try
    {
      return process.ExitCode;
    }
    catch
    {
      return int.MinValue;
    }
  }
}
