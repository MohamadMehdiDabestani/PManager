@cmms/web:dev: [auth][error] CredentialsSignin: Read more at https://errors.authjs.dev#credentialssignin
@cmms/web:dev:     at Module.callback (webpack-internal:///(rsc)/../../node_modules/.pnpm/@auth+core@0.37.2/node_modules/@auth/core/lib/actions/callback/index.js:246:23)
@cmms/web:dev:     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
@cmms/web:dev:     at async AuthInternal (webpack-internal:///(rsc)/../../node_modules/.pnpm/@auth+core@0.37.2/node_modules/@auth/core/lib/index.js:70:24)
@cmms/web:dev:     at async Auth (webpack-internal:///(rsc)/../../node_modules/.pnpm/@auth+core@0.37.2/node_modules/@auth/core/index.js:130:34)
@cmms/web:dev:     at async signIn (webpack-internal:///(rsc)/../../node_modules/.pnpm/next-auth@5.0.0-beta.25_next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0__react@19.0.0/node_modules/next-auth/lib/actions.js:53:17)
@cmms/web:dev:     at async loginAction (webpack-internal:///(rsc)/./src/app/actions/phase1-actions.ts:30:9)
@cmms/web:dev:     at async handleFormLogin (webpack-internal:///(rsc)/./src/app/login/page.tsx:37:5)
@cmms/web:dev:     at async D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:157:2088
@cmms/web:dev:     at async handleAction (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:156:21940)
@cmms/web:dev:  POST /login 200 in 91ms
@cmms/web:dev:     at async renderToHTMLOrFlightImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:161:22192)
@cmms/web:dev:     at async doRender (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:1565:34)
@cmms/web:dev:     at async responseGenerator (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:1813:28)
@cmms/web:dev:     at async DevServer.renderToResponseWithComponentsImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:1823:28)
@cmms/web:dev:     at async DevServer.renderPageComponent (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:2250:24)
@cmms/web:dev:     at async DevServer.renderToResponseImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:2288:32)
@cmms/web:dev:     at async DevServer.pipeImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:959:25)
@cmms/web:dev:     at async NextNodeServer.handleCatchallRenderRequest (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\next-server.js:281:17)
@cmms/web:dev:     at async DevServer.handleRequestImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\base-server.js:853:17)
@cmms/web:dev:     at async D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\dev\next-dev-server.js:371:20
@cmms/web:dev:     at async Span.traceAsyncFn (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\trace\trace.js:153:20)
@cmms/web:dev:     at async DevServer.handleRequest (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\dev\next-dev-server.js:368:24)
@cmms/web:dev:     at async invokeRender (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\router-server.js:230:21)
@cmms/web:dev:     at async handleRequest (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\router-server.js:408:24)
@cmms/web:dev:     at async requestHandlerImpl (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\router-server.js:432:13)
@cmms/web:dev:     at async Server.requestListener (D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\start-server.js:146:13)



@cmms/web:dev:  ⚠ ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: Critical dependency: the request of a dependency is an expression
@cmms/web:dev: 
@cmms/web:dev: Import trace for requested module:
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/index.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/index.js
@cmms/web:dev: ../../packages/queue/src/queues.ts
@cmms/web:dev: ../../packages/queue/src/index.ts
@cmms/web:dev: ./src/app/api/v1/sync/route.ts
@cmms/web:dev:  ⚠ ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: Critical dependency: the request of a dependency is an expression
@cmms/web:dev: 
@cmms/web:dev: Import trace for requested module:
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/index.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/index.js
@cmms/web:dev: ../../packages/queue/src/queues.ts
@cmms/web:dev: ../../packages/queue/src/index.ts
@cmms/web:dev: ./src/app/api/v1/sync/route.ts
@cmms/web:dev:  GET / 200 in 4406ms
@cmms/web:dev:  ⚠ ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: Critical dependency: the request of a dependency is an expression
@cmms/web:dev: 
@cmms/web:dev: Import trace for requested module:
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/index.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/index.js
@cmms/web:dev: ../../packages/queue/src/queues.ts
@cmms/web:dev: ../../packages/queue/src/index.ts
@cmms/web:dev: ./src/app/api/v1/sync/route.ts
@cmms/web:dev:  ⚠ ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: Critical dependency: the request of a dependency is an expression
@cmms/web:dev: 
@cmms/web:dev: Import trace for requested module:
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/index.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/index.js
@cmms/web:dev: ../../packages/queue/src/queues.ts
@cmms/web:dev: ../../packages/queue/src/index.ts
@cmms/web:dev: ./src/app/api/v1/sync/route.ts


@cmms/web:dev:  GET /work-orders 200 in 226ms
@cmms/web:dev:  GET /manifest.webmanifest 200 in 16ms
@cmms/web:dev:  GET /pm-schedules 200 in 283ms
@cmms/web:dev:  GET /work-orders/df5d9937-e655-4de5-8c95-7fbe4a235916 200 in 206ms
@cmms/web:dev:  GET /manifest.webmanifest 200 in 10ms
@cmms/web:dev:  ⚠ ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: Critical dependency: the request of a dependency is an expression
@cmms/web:dev: 
@cmms/web:dev: Import trace for requested module:
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/child-processor.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/classes/index.js
@cmms/web:dev: ../../node_modules/.pnpm/bullmq@5.34.3/node_modules/bullmq/dist/esm/index.js
@cmms/web:dev: ../../packages/queue/src/queues.ts
@cmms/web:dev: ../../packages/queue/src/index.ts
@cmms/web:dev: ./src/app/actions/phase2-actions.ts
@cmms/web:dev: ./src/app/pm-schedules/page.tsx
@cmms/web:dev:  ✓ Compiled /api/v1/sync in 2.2s (1121 modules)
@cmms/web:dev:  POST /api/v1/sync 200 in 5914ms
@cmms/web:dev:  POST /api/v1/sync 200 in 1777ms




@cmms/worker:dev: Error: read ECONNRESET
@cmms/worker:dev:     at TLSWrap.onStreamRead (node:internal/stream_base_commons:216:20) {
@cmms/worker:dev:   errno: -4077,
@cmms/worker:dev:   code: 'ECONNRESET',
@cmms/worker:dev:   syscall: 'read'
@cmms/worker:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }
@cmms/web:dev: [Error: read ECONNRESET] {
@cmms/web:dev:   errno: -4077,
@cmms/web:dev:   code: 'ECONNRESET',
@cmms/web:dev:   syscall: 'read'
@cmms/web:dev: }


@cmms/web:dev:  ⨯ Error: Cannot find module './4024.js'
@cmms/web:dev: Require stack:
@cmms/web:dev: - D:\PManager\apps\web\.next\server\webpack-runtime.js
@cmms/web:dev: - D:\PManager\apps\web\.next\server\app\manifest.webmanifest\route.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\require.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\load-components.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\utils.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\options.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\index.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\next-config-ts\transpile-config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\next.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\start-server.js
@cmms/web:dev:     at __webpack_require__.f.require (D:\PManager\apps\web\.next\server\webpack-runtime.js:208:28)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\webpack-runtime.js:116:40)
@cmms/web:dev:     at Array.reduce (<anonymous>)
@cmms/web:dev:     at __webpack_require__.e (D:\PManager\apps\web\.next\server\webpack-runtime.js:115:67)
@cmms/web:dev:     at Array.map (<anonymous>)
@cmms/web:dev:     at __webpack_require__.X (D:\PManager\apps\web\.next\server\webpack-runtime.js:167:22)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:4988)
@cmms/web:dev:     at Object.<anonymous> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:5036) {
@cmms/web:dev:   code: 'MODULE_NOT_FOUND',
@cmms/web:dev:   requireStack: [Array]
@cmms/web:dev: }
@cmms/web:dev:  ⨯ Error: Cannot find module './4024.js'
@cmms/web:dev: Require stack:
@cmms/web:dev: - D:\PManager\apps\web\.next\server\webpack-runtime.js
@cmms/web:dev: - D:\PManager\apps\web\.next\server\app\manifest.webmanifest\route.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\require.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\load-components.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\utils.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\options.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\index.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\next-config-ts\transpile-config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\next.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\start-server.js
@cmms/web:dev:     at __webpack_require__.f.require (D:\PManager\apps\web\.next\server\webpack-runtime.js:208:28)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\webpack-runtime.js:116:40)
@cmms/web:dev:     at Array.reduce (<anonymous>)
@cmms/web:dev:     at __webpack_require__.e (D:\PManager\apps\web\.next\server\webpack-runtime.js:115:67)
@cmms/web:dev:     at Array.map (<anonymous>)
@cmms/web:dev:     at __webpack_require__.X (D:\PManager\apps\web\.next\server\webpack-runtime.js:167:22)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:4988)
@cmms/web:dev:     at Object.<anonymous> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:5036) {
@cmms/web:dev:   code: 'MODULE_NOT_FOUND',
@cmms/web:dev:   requireStack: [Array]
@cmms/web:dev: }
@cmms/web:dev:  ⨯ Error: Cannot find module './4024.js'
@cmms/web:dev: Require stack:
@cmms/web:dev: - D:\PManager\apps\web\.next\server\webpack-runtime.js
@cmms/web:dev: - D:\PManager\apps\web\.next\server\app\manifest.webmanifest\route.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\require.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\load-components.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\utils.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\options.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\index.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\next-config-ts\transpile-config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\next.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\start-server.js
@cmms/web:dev:     at __webpack_require__.f.require (D:\PManager\apps\web\.next\server\webpack-runtime.js:208:28)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\webpack-runtime.js:116:40)
@cmms/web:dev:     at Array.reduce (<anonymous>)
@cmms/web:dev:     at __webpack_require__.e (D:\PManager\apps\web\.next\server\webpack-runtime.js:115:67)
@cmms/web:dev:     at Array.map (<anonymous>)
@cmms/web:dev:     at __webpack_require__.X (D:\PManager\apps\web\.next\server\webpack-runtime.js:167:22)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:4988)
@cmms/web:dev:     at Object.<anonymous> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:5036) {
@cmms/web:dev:   code: 'MODULE_NOT_FOUND',
@cmms/web:dev:   requireStack: [Array]
@cmms/web:dev: }
@cmms/web:dev:  ⨯ Error: Cannot find module './4024.js'
@cmms/web:dev: Require stack:
@cmms/web:dev: - D:\PManager\apps\web\.next\server\webpack-runtime.js
@cmms/web:dev: - D:\PManager\apps\web\.next\server\app\manifest.webmanifest\route.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\require.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\load-components.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\utils.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\options.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\swc\index.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\build\next-config-ts\transpile-config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\config.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\next.js
@cmms/web:dev: - D:\PManager\node_modules\.pnpm\next@15.1.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\node_modules\next\dist\server\lib\start-server.js
@cmms/web:dev:     at __webpack_require__.f.require (D:\PManager\apps\web\.next\server\webpack-runtime.js:208:28)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\webpack-runtime.js:116:40)
@cmms/web:dev:     at Array.reduce (<anonymous>)
@cmms/web:dev:     at __webpack_require__.e (D:\PManager\apps\web\.next\server\webpack-runtime.js:115:67)
@cmms/web:dev:     at Array.map (<anonymous>)
@cmms/web:dev:     at __webpack_require__.X (D:\PManager\apps\web\.next\server\webpack-runtime.js:167:22)
@cmms/web:dev:     at <unknown> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:4988)
@cmms/web:dev:     at Object.<anonymous> (D:\PManager\apps\web\.next\server\app\_not-found\page.js:1:5036) {
@cmms/web:dev:   code: 'MODULE_NOT_FOUND',
@cmms/web:dev:   requireStack: [Array]
@cmms/web:dev: }
@cmms/web:dev:  GET /_next/static/chunks/fallback/webpack.js 500 in 312ms
@cmms/web:dev:  GET /_next/static/chunks/fallback/main.js 500 in 307ms
@cmms/web:dev:  GET /_next/static/chunks/fallback/react-refresh.js 500 in 306ms
@cmms/web:dev:  GET /_next/static/chunks/fallback/pages/_app.js 500 in 305ms
@cmms/web:dev:  GET /_next/static/chunks/fallback/pages/_error.js 500 in 315ms
