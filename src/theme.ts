import {z} from 'zod';

/** Bounded design tokens. No CSS, URLs, HTML or executable expressions. */
export const themeSchema=z.strictObject({
  mode:z.enum(['light','dark']),
  palette:z.enum(['ocean','forest','berry']),
  font:z.enum(['system','serif','mono']),
  density:z.enum(['comfortable','compact']),
  textSize:z.enum(['standard','large']),
});
export type Theme=z.infer<typeof themeSchema>;
export const defaultTheme:Theme={mode:'light',palette:'ocean',font:'system',density:'comfortable',textSize:'standard'};
export const layoutSchema=z.strictObject({direction:z.enum(['auto','horizontal','vertical'])});
export type Layout=z.infer<typeof layoutSchema>;
export const defaultLayout:Layout={direction:'auto'};
export const presentationSchema=z.strictObject({
  version:z.literal(1),theme:themeSchema,layout:layoutSchema,
  template:z.strictObject({id:z.string().uuid(),version:z.number().int().min(1).max(20),name:z.string().trim().min(1).max(80)}).optional(),
});
export type Presentation=z.infer<typeof presentationSchema>;
const palettes={
  light:{ocean:['#245bb5','#9b4275','#176d60','#915d17','#6850a0','#486578','#ad383b','#596b1c'],forest:['#176d60','#7450a3','#a04f26','#285ba1','#9b4275','#576c22','#4d637c','#a1383c'],berry:['#953b72','#245bb5','#176d60','#915d17','#6850a0','#486578','#ad383b','#596b1c']},
  dark:{ocean:['#8eb9ff','#f1a4cb','#7bd4be','#e8bc71','#c6b0fa','#a9c8dd','#ffa5a6','#c0d787'],forest:['#7bd4be','#c6b0fa','#f2b791','#8eb9ff','#f1a4cb','#c0d787','#a9c8dd','#ffa5a6'],berry:['#f1a4cb','#8eb9ff','#7bd4be','#e8bc71','#c6b0fa','#a9c8dd','#ffa5a6','#c0d787']},
};
export function themeTokens(theme:Theme){
  const dark=theme.mode==='dark',colors=palettes[theme.mode][theme.palette];
  return {
    colors,accent:colors[0],background:dark?'#152131':'#fafcff',surface:dark?'#1e2e42':'#ffffff',
    text:dark?'#edf3fc':'#172c43',muted:dark?'#bccbdf':'#506176',border:dark?'#8194ad':'#8b9bb0',
    line:dark?'#40556f':'#dce4ef',tint:dark?'#293e56':'#edf2fa',highlight:dark?'#594c23':'#fff0b5',
    error:dark?'#452b2d':'#fff2ef',font:theme.font==='serif'?'Georgia, "Noto Serif", serif':theme.font==='mono'?'ui-monospace, SFMono-Regular, Consolas, monospace':'Inter, ui-sans-serif, system-ui, sans-serif',
    size:theme.textSize==='large'?16:14,padding:theme.density==='compact'?10:16,cell:theme.density==='compact'?7:10,
  };
}
export function themeStyle(theme:Theme):Record<string,string>{
  const t=themeTokens(theme);
  return Object.fromEntries(Object.entries({bg:t.background,surface:t.surface,text:t.text,muted:t.muted,border:t.border,line:t.line,tint:t.tint,highlight:t.highlight,error:t.error,accent:t.accent,font:t.font,size:`${t.size}px`,padding:`${t.padding}px`,cell:`${t.cell}px`,scheme:theme.mode}).map(([key,value])=>[`--su-${key}`,value]));
}
