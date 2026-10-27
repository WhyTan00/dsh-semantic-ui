import {createContext,useContext} from 'react';
import {defaultTheme,defaultLayout,themeTokens,type Theme,type Layout} from './theme';
export const AppearanceContext=createContext<{theme:Theme;layout:Layout;strictPolicy?:boolean;capacityDemandId?:string}>({theme:defaultTheme,layout:defaultLayout});
export function useAppearance(){const value=useContext(AppearanceContext);return {...value,tokens:themeTokens(value.theme)};}
