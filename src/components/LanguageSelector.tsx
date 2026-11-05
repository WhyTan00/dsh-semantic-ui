import {useI18n} from '../i18n';

/** Both language names remain recognizable even after choosing the wrong one. */
export function LanguageSelector(){
 const {t,locale,setLocale}=useI18n();
 return <div className="language-toolbar"><label><span>界面语言 / Language</span><select aria-label={t('Language')} value={locale} onChange={e=>setLocale(e.target.value==='en'?'en':'zh-CN')}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label></div>;
}
