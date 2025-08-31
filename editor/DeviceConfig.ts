//slarmoooo - Moved out of editorConfig because sample imports require access to that file, which causes problems when the audioworkletthread has a navigator
//so enjoy this tiny file ig
export const isMobile: boolean = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|android|ipad|playbook|silk/i.test(navigator.userAgent);
export const isOnMac: boolean = /^Mac/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent) || /^(iPhone|iPad|iPod)/i.test(navigator.platform) || /(iPhone|iPad|iPod)/i.test(navigator.userAgent);

export const ctrlSymbol: string = isOnMac ? "⌘" : "Ctrl+";
export const ctrlName: string = isOnMac ? "command" : "control";

//similar issue with the testing flag
export const version: string = "1.5"; // Currently using patch versions in display (unlike JB)
export const versionDisplayName: string = "Slarmoo's Box " + (TESTING ? "Testing " : "") + version;