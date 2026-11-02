Added latency: 80 ms per request (CDP emulation; applies to HTTP, not WebSocket frames).

| variant | CPU throttle | first rows ms | filter p50 ms | filter p95 ms | live update p50 ms | live update max ms | heap MB | transfer KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| query-server | 1× | 290 | 16.9 | 100 | 100 | 100.4 | 6 | 32 |
| query-client | 1× | 442 | 16.7 | 16.8 | 249.5 | 283.3 | 48 | 5257 |
| electric | 1× | 640 | 16.7 | 17.1 | 83.9 | 86 | 32 | 17566 |
| query-server | 4× | 385 | 16.9 | 116.8 | 99.9 | 101.1 | 6 | 32 |
| query-client | 4× | 744 | 27.8 | 36.7 | 487.2 | 519.2 | 48 | 5257 |
| electric | 4× | 1701 | 31.5 | 45.5 | 86.9 | 101.5 | 47 | 17578 |
