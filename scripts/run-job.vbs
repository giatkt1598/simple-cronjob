Option Explicit

Dim shell, nodePath, scriptPath, jobId, command
Set shell = CreateObject("WScript.Shell")

nodePath = WScript.Arguments(0)
scriptPath = WScript.Arguments(1)
jobId = WScript.Arguments(2)
command = Quote(nodePath) & " " & Quote(scriptPath) & " run --job " & Quote(jobId)

' WindowStyle 0 hides the console window; True waits for Node to finish.
shell.Run command, 0, True

Function Quote(value)
  Quote = Chr(34) & Replace(value, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
