Option Explicit
Dim shell, fso, root, pidFile, file, pid, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
pidFile = fso.BuildPath(root, "twisted-imagez-server.pid")

If fso.FileExists(pidFile) Then
  Set file = fso.OpenTextFile(pidFile, 1)
  pid = Trim(file.ReadAll)
  file.Close
  If IsNumeric(pid) Then
    command = "taskkill /PID " & pid & " /F"
    shell.Run command, 0, True
    If fso.FileExists(pidFile) Then fso.DeleteFile pidFile, True
  End If
End If

