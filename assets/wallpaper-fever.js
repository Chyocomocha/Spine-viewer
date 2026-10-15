"use strict";

// Draw every exported skeleton in the original shared coordinates, background first.
const layers = [
    { name: "skeleton", animation: "animation" },
    { name: "Hina_Fever", animation: "animation" },
    { name: "Mongle_Fever", animation: "animation" },
    { name: "Narin_Fever", animation: "Idle" }
];
const canvas = document.getElementById("scene");
const status = document.getElementById("status");
let renderer;
let assets;
let frameId;
let stopped = false;

canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(frameId);
    status.textContent = "화면 연결이 끊겼습니다. 뷰어를 새로고침해 주세요.";
    status.hidden = false;
    if (window.parent !== window) window.parent.postMessage("spine-context-lost", window.location.origin);
});

async function start() {
    try {
        const gl = canvas.getContext("webgl", { alpha: false });
        if (!gl) throw new Error("WebGL을 사용할 수 없습니다.");
        renderer = new spine.SceneRenderer(canvas, gl);
        assets = new spine.AssetManager(gl, "./assets/wallpaper-fever/");
        const scene = await Promise.all(layers.map(async layer => {
            const [binary, atlas] = await Promise.all([
                assets.loadBinaryAsync(`${layer.name}.skel.bytes`),
                assets.loadTextureAtlasAsync(`${layer.name}.atlas.txt`)
            ]);
            const data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(binary);
            const skeleton = new spine.Skeleton(data);
            const state = new spine.AnimationState(new spine.AnimationStateData(data));
            state.setAnimation(0, layer.animation, true);
            state.apply(skeleton);
            skeleton.updateWorldTransform(spine.Physics.update);
            return { skeleton, state };
        }));
        if (stopped) return;
        const background = scene[0].skeleton.data;
        renderer.camera.position.x = background.x + background.width / 2;
        renderer.camera.position.y = background.y + background.height / 2;
        status.hidden = true;
        let previous = performance.now();
        function render(now) {
            if (stopped) return;
            const delta = Math.min((now - previous) / 1000, 0.1);
            previous = now;
            renderer.camera.setViewport(background.width, background.height);
            renderer.resize(spine.ResizeMode.Fit);
            gl.clearColor(0.098, 0.098, 0.098, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            renderer.begin();
            for (const { skeleton, state } of scene) {
                skeleton.update(delta);
                state.update(delta);
                state.apply(skeleton);
                skeleton.updateWorldTransform(spine.Physics.update);
                renderer.drawSkeleton(skeleton, true);
            }
            renderer.end();
            frameId = requestAnimationFrame(render);
        }
        frameId = requestAnimationFrame(render);
    } catch (error) {
        console.error(error);
        status.textContent = "연출을 불러오지 못했습니다. 새로고침해 주세요.";
        status.hidden = false;
    }
}

window.addEventListener("pagehide", () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    renderer?.dispose();
    assets?.dispose();
});
start();
