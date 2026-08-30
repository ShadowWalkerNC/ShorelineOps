' Shoreline Care OS — Silent Launcher
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "node launcher.js --silent", 0, False
Set WshShell = Nothing
