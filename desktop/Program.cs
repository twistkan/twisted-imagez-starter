using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TwistedImagez.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private const int Port = 18767;
    private readonly string _root = ResolveRuntimeRoot();
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMilliseconds(500) };
    private readonly WebView2 _browser = new() { Dock = DockStyle.Fill };
    private Process? _server;
    private bool _ownsServer;

    public MainForm()
    {
        Text = "Twisted Imagez";
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(960, 640);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(_browser);
        Shown += async (_, _) => await LoadApplicationAsync();
        FormClosing += (_, _) => StopServer();
    }

    private static string ResolveRuntimeRoot()
    {
        var baseDirectory = AppContext.BaseDirectory;
        var processName = Path.GetFileNameWithoutExtension(Environment.ProcessPath ?? string.Empty);
        if (string.Equals(processName, "TwistedImagez.OneClick", StringComparison.OrdinalIgnoreCase))
            return ExtractEmbeddedRuntime();

        if (File.Exists(Path.Combine(baseDirectory, "server.ps1"))) return baseDirectory;

        var bundledDirectory = Path.Combine(baseDirectory, "publish");
        if (File.Exists(Path.Combine(bundledDirectory, "server.ps1"))) return bundledDirectory;

        return baseDirectory;
    }

    private static string ExtractEmbeddedRuntime()
    {
        var runtimeRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Twisted Imagez Starter",
            "OneClickRuntime");

        var files = new Dictionary<string, string>
        {
            ["TwistedImagez.Desktop.Embedded.app.index.html"] = Path.Combine("app", "index.html"),
            ["TwistedImagez.Desktop.Embedded.app.app.js"] = Path.Combine("app", "app.js"),
            ["TwistedImagez.Desktop.Embedded.app.styles.css"] = Path.Combine("app", "styles.css"),
            ["TwistedImagez.Desktop.Embedded.server.ps1"] = "server.ps1"
        };

        foreach (var file in files)
        {
            var target = Path.Combine(runtimeRoot, file.Value);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(file.Key)
                ?? throw new FileNotFoundException("Embedded desktop resource was not found.", file.Key);
            using var output = File.Create(target);
            resource.CopyTo(output);
        }

        var dataFile = Path.Combine(runtimeRoot, "data", "twisted-imagez-data.json");
        if (!File.Exists(dataFile))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(dataFile)!);
            using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("TwistedImagez.Desktop.Embedded.data.twisted-imagez-data.json")
                ?? throw new FileNotFoundException("Embedded data resource was not found.");
            using var output = File.Create(dataFile);
            resource.CopyTo(output);
        }

        return runtimeRoot;
    }

    private async Task LoadApplicationAsync()
    {
        try
        {
            EnsureDesktopShortcut();
            await EnsureServerAsync();

            var userData = Path.Combine(_root, "data", "desktop-webview");
            Directory.CreateDirectory(userData);
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            await _browser.EnsureCoreWebView2Async(environment);
            _browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _browser.CoreWebView2.Navigate($"http://127.0.0.1:{Port}/app/");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Twisted Imagez could not start. Make sure Microsoft Edge WebView2 Runtime is installed, then try again.\n\n" + ex.Message,
                "Twisted Imagez Starter",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task EnsureServerAsync()
    {
        if (await IsServerReadyAsync()) return;

        var serverScript = Path.Combine(_root, "server.ps1");
        if (!File.Exists(serverScript))
            throw new FileNotFoundException("The local application server was not found.", serverScript);

        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{serverScript}\" -Port {Port} -NoBrowser",
            WorkingDirectory = _root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };

        _server = Process.Start(startInfo) ?? throw new InvalidOperationException("The local application server could not be started.");
        _ownsServer = true;

        for (var attempt = 0; attempt < 40; attempt++)
        {
            if (await IsServerReadyAsync()) return;
            await Task.Delay(250);
        }

        throw new InvalidOperationException("The local application server did not respond in time.");
    }

    private async Task<bool> IsServerReadyAsync()
    {
        try
        {
            using var response = await _http.GetAsync($"http://127.0.0.1:{Port}/app/");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void EnsureDesktopShortcut()
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrWhiteSpace(desktop)) return;

        var shortcutPath = Path.Combine(desktop, "Twisted Imagez Starter.lnk");
        if (File.Exists(shortcutPath)) return;

        try
        {
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = Application.ExecutablePath;
            shortcut.WorkingDirectory = _root;
            shortcut.IconLocation = Application.ExecutablePath + ",0";
            shortcut.Description = "Open Twisted Imagez booking and invoicing";
            shortcut.Save();
        }
        catch
        {
            // A shortcut is helpful but should never prevent the app from opening.
        }
    }

    private void StopServer()
    {
        if (!_ownsServer || _server is null) return;
        try
        {
            if (!_server.HasExited) _server.Kill(entireProcessTree: true);
        }
        catch
        {
            // The server may already have closed during shutdown.
        }
        finally
        {
            _server.Dispose();
            var pidFile = Path.Combine(_root, "twisted-imagez-server.pid");
            try
            {
                if (File.Exists(pidFile)) File.Delete(pidFile);
            }
            catch
            {
                // The server may still be finishing its own cleanup.
            }
        }
    }
}
