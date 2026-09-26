# Check exit animations

Run `bun bench/presence/serve.ts`, open <http://localhost:4666>, and click **Run checks**. Keep the browser tab visible until the result appears. The suite expects 26 passing checks.

The suite samples opacity and height every animation frame during 12 dialog closes and 12 accordion closes. An increase before the element is hidden fails the check. The CSS deliberately uses no animation fill mode, matching the reported bejamas/ui flash. Closing begins partway through a frame to expose the difference between CSS animation start times and the JavaScript timestamp.

The remaining checks verify that a shorter transition does not hide an element before its longer transition finishes and that reopening cancels a pending exit.

To compare against the affected release, stop the server and run `bun bench/presence/serve.ts --baseline`. This bundles the presence lifecycle from the local `v1.0.1` Git tag with the same components and test page. Reload the browser and run the checks again. Flicker counts vary with frame timing. The baseline should fail some closing checks.
