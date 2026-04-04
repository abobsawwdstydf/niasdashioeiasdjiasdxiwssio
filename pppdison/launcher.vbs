' ============================================================
' Nexo Messenger - Universal Launcher
' Запускает приложение для текущей платформы
' ============================================================

Option Explicit

Dim WshShell, FSO, AppPath, Platform
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Detect platform
Platform = "windows"
If FSO.FileExists(AppPath & "\linux\NexoMessenger.vbs") Then
    Platform = "linux"
End If
If FSO.FileExists(AppPath & "\macos\NexoMessenger.vbs") Then
    Platform = "macos"
End If
If FSO.FileExists(AppPath & "\android\NexoMessenger.vbs") Then
    Platform = "android"
End If

' Show platform menu
Dim choice
choice = MsgBox("Выберите платформу:" & vbCrLf & vbCrLf & _
       "1 - Windows (VBS GUI приложение)" & vbCrLf & _
       "2 - Android (APK)" & vbCrLf & _
       "3 - macOS (DMG)" & vbCrLf & _
       "4 - Linux" & vbCrLf & _
       "5 - Web (браузер)" & vbCrLf & _
       "6 - Настройки сервера", _
       vbQuestion + vbOKCancel, "Nexo Messenger - Выбор платформы")

If choice = vbOK Then
    Dim serverURL
    serverURL = "http://localhost:3001"
    
    ' Check for saved server URL
    On Error Resume Next
    Dim savedURL
    savedURL = WshShell.RegRead("HKCU\Software\NexoMessenger\ServerURL\")
    If Err.Number = 0 And savedURL <> "" Then
        serverURL = savedURL
    End If
    Err.Clear
    On Error GoTo 0
    
    Dim platformChoice
    platformChoice = InputBox("Выберите платформу (1-6):", "Nexo Messenger", "1")
    
    Select Case platformChoice
        Case "1" ' Windows VBS
            If FSO.FileExists(AppPath & "\windows\NexoMessenger.vbs") Then
                WshShell.Run "wscript.exe """ & AppPath & "\windows\NexoMessenger.vbs""", 1, False
            Else
                MsgBox "VBS приложение не найдено в папке windows/", vbCritical
            End If
            
        Case "2" ' Android
            If FSO.FileExists(AppPath & "\android\build.bat") Then
                Dim buildChoice
                buildChoice = MsgBox("Скомпилировать APK?" & vbCrLf & "Да - начать сборку" & vbCrLf & "Нет - открыть папку", vbYesNo + vbQuestion)
                If buildChoice = vbYes Then
                    WshShell.Run "cmd /k cd /d """ & AppPath & "\android"" && build.bat", 1, False
                Else
                    WshShell.Run "explorer.exe """ & AppPath & "\android""", 1, False
                End If
            Else
                MsgBox "Папка android не найдена", vbCritical
            End If
            
        Case "3" ' macOS
            If FSO.FileExists(AppPath & "\macos\app\main.js") Then
                MsgBox "Для сборки macOS приложения нужен macOS" & vbCrLf & vbCrLf & _
                       "Папка: macos/app/" & vbCrLf & _
                       "Сборка: ./build.sh", vbInformation
            End If
            
        Case "4" ' Linux
            MsgBox "Для Linux используйте:" & vbCrLf & _
                   "1. Web-версию: " & serverURL & vbCrLf & _
                   "2. Electron приложение из папки linux/", vbInformation
                   
        Case "5" ' Web
            WshShell.Run serverURL, 1, False
            
        Case "6" ' Settings
            Dim newURL
            newURL = InputBox("Введите URL сервера:", "Настройки сервера", serverURL)
            If newURL <> "" Then
                WshShell.RegWrite "HKCU\Software\NexoMessenger\ServerURL\", newURL, "REG_SZ"
                MsgBox "URL сервера сохранён: " & newURL, vbInformation
            End If
            
        Case Else
            If platformChoice <> "" Then
                MsgBox "Неверный выбор", vbCritical
            End If
    End Select
End If

Set WshShell = Nothing
Set FSO = Nothing
