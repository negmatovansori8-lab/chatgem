import { ACCENT_STORAGE_KEY, ACCENTS, DEFAULT_ACCENT, accentVars } from "@/lib/accent";

const accentTable = Object.fromEntries(
  ACCENTS.filter((a) => a.id !== DEFAULT_ACCENT).map((a) => [a.id, accentVars(a.color)]),
);

/**
 * Runs in `<head>` before first paint: tags `<html>` with the device class (see `detectDeviceKind`)
 * and applies the saved accent color, so neither flashes after hydration.
 */
export const BOOT_SCRIPT = `(function(){var r=document.documentElement;try{var n=navigator,u=n.userAgent||"",t=(n.maxTouchPoints||0)>0,m=function(q){return matchMedia(q).matches},c=m("(pointer: coarse)")&&!m("(any-pointer: fine)"),ip=/iPad/.test(u)||(/Macintosh/.test(u)&&t),tb=ip||(/Android/i.test(u)&&!/Mobile/i.test(u))||/Tablet|Silk|Kindle/i.test(u),ph=(n.userAgentData&&n.userAgentData.mobile===true)||/iPhone|iPod|Android.+Mobile|Windows Phone|Mobi/i.test(u),s=Math.min(screen.width,screen.height),l=Math.max(screen.width,screen.height);r.dataset.device=tb?"tablet":ph?"phone":c?(s<600?"phone":"tablet"):(l>=1680&&s>=950?"desktop":"laptop");r.dataset.touch=t?"1":"0"}catch(e){}try{var a=${JSON.stringify(accentTable)}[localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)})];if(a)for(var k in a)r.style.setProperty(k,a[k])}catch(e){}})()`;
