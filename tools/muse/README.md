# Muse developer lab

This isolated toolkit adds Muse Spark SDK access using the official OpenAI-compatible Meta Model API and a pinned Linux Gadget SDK dependency manifest. It is not imported by the browser or API. It does not connect to the application database, execute gadget commands, pair devices, or upload project files.

Install Spark tooling with `npm ci --prefix tools/muse`. Run `npm --prefix tools/muse run check` and `npm --prefix tools/muse test` offline. Configure `MODEL_API_KEY` in the terminal environment, never a `VITE_` variable or committed file. `npm --prefix tools/muse run spark:smoke` makes one bounded, fixed synthetic request to Meta; arbitrary prompts/files and clinical records are not accepted. Missing credentials and unexpected responses fail closed. No credential or provider error body is printed. This probe costs provider usage and is not part of the app test runner.

The Gadget SDK targets ESP32 or Linux/Raspberry Pi, not a Windows browser. On an isolated Linux lab host, a virtual environment can install `python -m pip install -r gadget-requirements.txt`. The dependency is pinned to reviewed upstream commit `9f5ab2335b34b7f1017a728aa8beb9d0cf08de8f`. Installation, Bluetooth pairing and physical-device acceptance remain separate. Use a dedicated account without sudo and with no Shoreline data or credentials. Do not install its general shell/file daemon on a clinical server.

Current Gadget token terms permit personal non-commercial use and restrict distribution. Commercial adoption is blocked pending a suitable written arrangement or a different supported device protocol. The source license does not remove token/service restrictions. No tokens have been generated or accepted by this toolkit.

Sources: [Meta Model API quickstart](https://dev.meta.ai/docs/quickstart), [Gadget source](https://github.com/facebookincubator/muse-gadget-sdk), [Gadget token terms](https://gadgets.muse.ai/sdk-terms). Muse Code SDK is a separate agent-session protocol; it is not a replacement name for Spark. Muse CLI is not invoked by these scripts.
