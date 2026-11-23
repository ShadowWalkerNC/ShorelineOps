Unicode true
Name "ShorelineOps Platform Proof"
OutFile "${INSTALLER}"
InstallDir "$LOCALAPPDATA\Programs\ShorelineOps Platform Proof"
RequestExecutionLevel user
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section
  SetOutPath "$INSTDIR"
  File /oname=shorelineops-worklist.exe "${WORKLIST}"
  File /oname=shorelineops-facility-host.exe "${FACILITYHOST}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShorelineOpsPlatformProof" "DisplayName" "ShorelineOps Platform Proof"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShorelineOpsPlatformProof" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  CreateShortcut "$SMPROGRAMS\ShorelineOps Platform Proof.lnk" "$INSTDIR\shorelineops-worklist.exe"
SectionEnd

Section Uninstall
  Delete "$SMPROGRAMS\ShorelineOps Platform Proof.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShorelineOpsPlatformProof"
  Delete "$INSTDIR\shorelineops-worklist.exe"
  Delete "$INSTDIR\shorelineops-facility-host.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
