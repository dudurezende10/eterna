// Eterna-Servidor.exe: roda o instalar-servidor.ps1 (embutido no .exe na hora de montar) como administrador.
// Montar: powershell -ExecutionPolicy Bypass -File agente\instalador\montar.ps1
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class EternaServidor {
    static int Main() {
        string ps1 = Path.Combine(Path.GetTempPath(), "eterna-instalar-servidor.ps1");
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("instalar-servidor.ps1"))
        using (FileStream f = File.Create(ps1)) { s.CopyTo(f); }
        ProcessStartInfo pi = new ProcessStartInfo("powershell.exe",
            "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\" -Pausa");
        pi.UseShellExecute = false;
        Process p = Process.Start(pi);
        p.WaitForExit();
        try { File.Delete(ps1); } catch { }
        return p.ExitCode;
    }
}
