using System.Text;

namespace Netracer.ServiceHost;

public sealed class ServiceLog : IDisposable
{
  private readonly object _sync = new();
  private readonly StreamWriter _writer;

  public ServiceLog(string filePath)
  {
    Directory.CreateDirectory(Path.GetDirectoryName(filePath) ?? AppContext.BaseDirectory);
    _writer = new StreamWriter(new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite), Encoding.UTF8)
    {
      AutoFlush = true
    };
  }

  public void Write(string channel, string message)
  {
    lock (_sync)
    {
      _writer.WriteLine($"{DateTimeOffset.Now:O} [{channel}] {message}");
    }
  }

  public void Dispose()
  {
    lock (_sync)
    {
      _writer.Dispose();
    }
  }
}
