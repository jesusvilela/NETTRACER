namespace Netracer.ServiceHost;

public sealed class NetracerSupervisorOptions
{
  public const string DefaultServiceName = "NetracerWatchdog";

  public string RepoRoot { get; set; } = "";
  public string NodePath { get; set; } = "node";
  public string ChildArguments { get; set; } = "src/index.js";
  public int Port { get; set; } = 8787;
  public string Host { get; set; } = "0.0.0.0";
  public string DataDir { get; set; } = "data";
  public string HealthUrl { get; set; } = "";
  public int PollIntervalSeconds { get; set; } = 15;
  public int HealthTimeoutSeconds { get; set; } = 5;
  public int StartupGraceSeconds { get; set; } = 25;
  public int RestartDelaySeconds { get; set; } = 5;
  public int StopTimeoutSeconds { get; set; } = 15;
  public int UnhealthyThreshold { get; set; } = 3;
  public string LogDirectory { get; set; } = "";

  public void ApplyDefaults()
  {
    RepoRoot = string.IsNullOrWhiteSpace(RepoRoot)
      ? Directory.GetParent(AppContext.BaseDirectory)?.Parent?.Parent?.Parent?.FullName ?? AppContext.BaseDirectory
      : Path.GetFullPath(RepoRoot);

    NodePath = string.IsNullOrWhiteSpace(NodePath) ? "node" : NodePath.Trim();
    ChildArguments = string.IsNullOrWhiteSpace(ChildArguments) ? "src/index.js" : ChildArguments.Trim();
    Port = NormalizeInt(Port, 8787, 1, 65535);
    Host = string.IsNullOrWhiteSpace(Host) ? "0.0.0.0" : Host.Trim();
    DataDir = string.IsNullOrWhiteSpace(DataDir) ? "data" : DataDir.Trim();
    HealthUrl = string.IsNullOrWhiteSpace(HealthUrl) ? $"http://127.0.0.1:{Port}/healthz" : HealthUrl.Trim();
    PollIntervalSeconds = NormalizeInt(PollIntervalSeconds, 15, 3, 300);
    HealthTimeoutSeconds = NormalizeInt(HealthTimeoutSeconds, 5, 1, 60);
    StartupGraceSeconds = NormalizeInt(StartupGraceSeconds, 25, 5, 300);
    RestartDelaySeconds = NormalizeInt(RestartDelaySeconds, 5, 1, 60);
    StopTimeoutSeconds = NormalizeInt(StopTimeoutSeconds, 15, 1, 120);
    UnhealthyThreshold = NormalizeInt(UnhealthyThreshold, 3, 1, 20);
    LogDirectory = string.IsNullOrWhiteSpace(LogDirectory)
      ? Path.Combine(RepoRoot, DataDir, "state", "service-logs")
      : Path.GetFullPath(LogDirectory);
  }

  public void Validate()
  {
    if (string.IsNullOrWhiteSpace(RepoRoot) || !Directory.Exists(RepoRoot))
    {
      throw new DirectoryNotFoundException($"Repo root not found: {RepoRoot}");
    }
  }

  private static int NormalizeInt(int value, int fallback, int min, int max)
  {
    if (value < min || value > max)
    {
      return fallback;
    }
    return value;
  }
}
