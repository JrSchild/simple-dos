import * as cluster from 'cluster';
import worker from './src/worker';
import master from './src/master';

if (cluster.isMaster) {
  master().catch(err => {
    console.error('An error occured during startup');
    console.error(err);
  });
} else {
  worker().catch(err => {
    console.error('An error occured in the worker');
    console.error(err);
  });
}
