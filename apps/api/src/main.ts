import { APP_MODE } from './config/configuration';
import { bootstrapHttp } from './main.http';
import { bootstrapWorker } from './main.worker';

void (process.env.MODE === APP_MODE.WORKER ? bootstrapWorker() : bootstrapHttp());
