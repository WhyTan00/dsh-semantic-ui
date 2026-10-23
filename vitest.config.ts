import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts'],exclude:['.handoff/**','node_modules/**'],maxWorkers:2}});
