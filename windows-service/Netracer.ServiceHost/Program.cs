using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Netracer.ServiceHost;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService((options) =>
{
  options.ServiceName = NetracerSupervisorOptions.DefaultServiceName;
});

builder.Services
  .AddOptions<NetracerSupervisorOptions>()
  .Bind(builder.Configuration.GetSection("Supervisor"))
  .PostConfigure((options) => options.ApplyDefaults());

builder.Services.AddSingleton<HttpClient>();
builder.Services.AddHostedService<NetracerSupervisor>();

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole((options) =>
{
  options.SingleLine = true;
  options.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
});

await builder.Build().RunAsync();
