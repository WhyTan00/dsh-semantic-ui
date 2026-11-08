import './csp';
import {createRoot} from 'react-dom/client';
import {TaskFormPanel} from './TaskFormPanel';
const root=document.getElementById('task-root');if(!root)throw Error('TASK_ROOT_MISSING');
createRoot(root).render(<TaskFormPanel expanded/>);
