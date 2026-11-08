// Run before application schemas initialize. This entry is only for the offline
// page; the existing DSH client's validation configuration is left alone.
import {config} from 'zod';
config({jitless:true});
