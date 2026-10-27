import type {ViewState} from './dsh/events';
import type {LibraryBridge} from './templates';
import type {SourceUpdateBridge} from './source-update-contract';
/** Build seam: resolved to the self-contained React 19 bundle by scripts/build.mjs. */
export declare function mount(element:HTMLElement,state:ViewState,bridge?:LibraryBridge,updateBridge?:SourceUpdateBridge):{update(state:ViewState):void;dispose():void};
