' ============================================================
' Nexo Messenger - Android VBS Application
' ============================================================

Option Explicit

Dim WshShell, ServerURL
Set WshShell = CreateObject("WScript.Shell")

ServerURL = "http://localhost:3001"

MsgBox "Nexo Messenger для Android" & vbCrLf & vbCrLf & _
       "Для установки:" & vbCrLf & _
       "1. Скомпилируйте APK: android/build.bat" & vbCrLf & _
       "2. Установите APK на устройство" & vbCrLf & vbCrLf & _
       "Или используйте Web-версию:" & vbCrLf & _
       ServerURL & vbCrLf & vbCrLf & _
       "Сервер: " & ServerURL, _
       vbInformation, "Nexo Messenger - Android"

Set WshShell = Nothing
