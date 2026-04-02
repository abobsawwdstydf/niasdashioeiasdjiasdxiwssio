; Nexo Messenger Dark Theme Installer
; Styled to match the messenger UI

!include "MUI2.nsh"
!include "LogicLib.nsh"

; Dark theme colors
!define MUI_BGCOLOR "09090b"
!define MUI_TEXTCOLOR "ffffff"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\welcome.bmp"
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"

; Custom pages
!define MUI_WELCOMEPAGE_TITLE "Welcome to Nexo Messenger"
!define MUI_WELCOMEPAGE_TEXT "Welcome to the Nexo Messenger Setup Wizard.$\r$\n$\r$\nThis will install Nexo Messenger on your computer.$\r$\n$\r$\nNexo is a modern real-time messaging application with end-to-end encryption.$\r$\n$\r$\n$_CLICKNEXT"

!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose where to install Nexo Messenger:"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Nexo Messenger"

!define MUI_FINISHPAGE_TITLE "Complete Nexo Messenger Setup"
!define MUI_FINISHPAGE_TEXT "Nexo Messenger has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard and launch Nexo Messenger.$\r$\n$\r$\nVisit https://nexo-0hs3.onrender.com for more information."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Nexo Messenger.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Nexo Messenger"

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Russian"

; Custom styles
Function .onInit
  ; Set installer title
  StrCpy $INSTDIR "$PROGRAMFILES64\Nexo Messenger"
FunctionEnd

Function .onSelChange
FunctionEnd

; Custom welcome page with dark theme
Function CustomWelcome
  nsDialogs::Create 1018
  Pop $0
  
  ; Dark background
  SetCtlColors $0 0xffffff 0x09090b
  
  ; Welcome text
  ${NSD_CreateLabel} 0 0 100% 100u "Welcome to Nexo Messenger Setup$\r$\n$\r$\nModern Real-time Messaging$\r$\nEnd-to-end Encrypted$\r$\nBeautiful Dark Theme"
  Pop $0
  SetCtlColors $0 0xffffff 0x09090b
  
  nsDialogs::Show
FunctionEnd

; Custom install directory page
Function CustomDirectory
  nsDialogs::Create 1018
  Pop $0
  
  ; Directory label
  ${NSD_CreateLabel} 0 0 100% 20u "Install Nexo Messenger to:"
  Pop $0
  
  ; Directory text
  ${NSD_CreateText} 0 25u 100% 20u "$INSTDIR"
  Pop $DIR_TEXT
  
  ; Browse button
  ${NSD_CreateButton} 80% 50u 20% 20u "Browse..."
  Pop $BROWSE_BTN
  ${NSD_OnClick} $BROWSE_BTN BrowseDirectory
  
  nsDialogs::Show
FunctionEnd

Function BrowseDirectory
  nsDialogs::SelectFolderDialog "Select Installation Folder" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    StrCpy $INSTDIR $0
    ${NSD_SetText} $DIR_TEXT $INSTDIR
  ${EndIf}
FunctionEnd

; Create shortcuts
Function CreateShortcuts
  CreateShortCut "$DESKTOP\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
  CreateShortCut "$SMPROGRAMS\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
FunctionEnd

; Uninstall function
Function Uninstall
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Nexo Messenger.lnk"
  Delete "$SMPROGRAMS\Nexo Messenger.lnk"
FunctionEnd
