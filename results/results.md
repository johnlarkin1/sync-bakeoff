| variant | CPU throttle | first rows ms | filter p50 ms | filter p95 ms | live update p50 ms | live update max ms | heap MB | transfer KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| query-server | 1× | 66 | 16.7 | 33.4 | 32.6 | 33.4 | 6 | 32 |
| query-client | 1× | 289 | 16.7 | 16.8 | 246.4 | 262.4 | 68 | 5257 |
| electric | 1× | 432 | 16.7 | 17.5 | 21.2 | 23.4 | 51 | 17540 |
| query-server | 4× | 152 | 16.8 | 50 | 33.2 | 33.8 | 6 | 32 |
| query-client | 4× | 479 | 17.5 | 33.7 | 411.7 | 441.2 | 68 | 5257 |
| electric | 4× | 1540 | 33.4 | 74.7 | 107.4 | 121.1 | 62 | 17552 |
