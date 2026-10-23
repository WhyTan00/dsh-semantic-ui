import type {ViewState} from './dsh/events';
import type {LibraryBridge} from './templates';
/** Build seam: resolved to the self-contained React 19 bundle by scripts/build.mjs. */
export declare function mount(element:HTMLElement,state:ViewState,bridge?:LibraryBridge):{update(state:ViewState):void;dispose():void};
