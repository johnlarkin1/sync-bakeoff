Added latency: 80 ms per request (CDP emulation; applies to HTTP, not WebSocket frames).

| variant | CPU throttle | first rows ms | filter p50 ms | filter p95 ms | live update p50 ms | live update max ms | heap MB | transfer KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| query-server | 1× | 342 | 16.8 | 100.4 | 100.1 | 101.7 | 9 | 33 |
| query-client | 1× | 628 | 16.7 | 17.5 | 402.3 | 713.7 | 52 | 5258 |
| electric | 1× | 661 | 16.7 | 17.2 | 85.5 | 87.2 | 77 | 17682 |
| yrs | 1× | 944 | 16.6 | 16.9 | 85 | 86.8 | 82 | 16969 |
| zero | 1× | 2136 | 33.3 | 35.3 | 87.9 | 250.6 | 43 | 17522 |
| replicache | 1× | 714 | 16.7 | 17.5 | 114.6 | 116.8 | 50 | 1150 |
| livestore | 1× | 4328 | 19.8 | 51.1 | 122.1 | 141.6 | 215 | 881 |
| query-server | 4× | 540 | 17 | 110.4 | 100.1 | 100.8 | 9 | 33 |
| query-client | 4× | 814 | 18.2 | 33.8 | 455.8 | 487.3 | 52 | 5258 |
| electric | 4× | 1771 | 32.4 | 44.3 | 87.2 | 99.5 | 89 | 17720 |
| yrs | 4× | 2942 | 53.6 | 83.7 | 138.6 | 251.6 | 85 | 16969 |
| zero | 4× | 10460 | 155 | 258.8 | 86.9 | 105.8 | 73 | 17522 |
| replicache | 4× | 2781 | 32.7 | 47.5 | 206.1 | 238.7 | 68 | 1150 |
| livestore | 4× | 22141 | 187.3 | 401.2 | 428.6 | 495.4 | 186 | 881 |
