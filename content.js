function initLiliana() {
    /**
     * @param {string} path
     */
    function assetUrl(path) {
        if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
            return chrome.runtime.getURL(path);
        }
        return path;
    }

    function ensurePetDOM() {
        let root = document.getElementById("liliana");
        if (root) return root;

        root = document.createElement("div");
        root.id = "liliana";
        root.className = "pet standing";
        root.innerHTML = `
            <div id="pet-visual">
                <img
                    id="pet-image"
                    src="${assetUrl("asset/standing/standing.png")}"
                    alt="Liliana"
                    draggable="false"
                >
                <div id="hitboxes">
                    <div class="hitbox" id="head-area" data-action="head"></div>
                    <div class="hitbox" id="ear-area" data-action="ear"></div>
                    <div class="hitbox" id="body-area" data-action="body"></div>
                    <div class="hitbox" id="tail-area" data-action="tail"></div>
                </div>
            </div>
        `;
        (document.body || document.documentElement).appendChild(root);
        return root;
    }

    const liliana = ensurePetDOM();
    const petImage = document.getElementById("pet-image");
    const hitboxes = document.getElementById("hitboxes");
    const petVisual = document.getElementById("pet-visual");
    if (!liliana || !petImage || !hitboxes || !petVisual) {
        console.error("Liliana Web Pet: Missing DOM elements!");
        return;
    }

    console.log("Liliana Web Pet initialized!");

    const petState = {
        pose: "standing",
        interaction: null,
        isDragging: false,
        direction: "idle"
    };

    const imageScale = {
        standing: 2.3,
        sitting: 2.3,
        sittingFall: 1.65,
        left: 2.3,
        right: 2.3,
        interaction: 2.32,
        dragging: 2.3,
        falling: 2.3
    };

    /**
     * @param {number} scaleValue
     */
    function applyScale(scaleValue) {
        petVisual.style.transform = `scale(${scaleValue})`;
    }

    const petImages = {
        sitting: assetUrl("asset/sitting/sitting1.png"),
        sittingFall: assetUrl("asset/sitting/sitting4.png"),
        standing: assetUrl("asset/standing/standing.png"),
        dragging: assetUrl("asset/interaction/drag.png"),
        falling: assetUrl("asset/interaction/falling.png"),
        left: assetUrl("asset/walking/walkLeft.png"),
        right: assetUrl("asset/walking/walkRight.png"),
    };

    const sittingFrames = [
        assetUrl("asset/sitting/sitting1.png"),
        assetUrl("asset/sitting/sitting2.png"),
        assetUrl("asset/sitting/sitting3.png"),
        assetUrl("asset/sitting/sitting2.png")
    ];

    let sittingIntervalId = null;
    let sittingFrameIndex = 0;

    function stopSittingAnimation() {
        if (sittingIntervalId !== null) {
            clearInterval(sittingIntervalId);
            sittingIntervalId = null;
        }
        sittingFrameIndex = 0;
    }

    function startSittingAnimation() {
        stopSittingAnimation();
        sittingFrameIndex = 0;
        petImage.src = sittingFrames[sittingFrameIndex];
        applyScale(imageScale.sitting);

        sittingIntervalId = setInterval(() => {
            if (
                petState.pose !== "sitting" ||
                petState.interaction !== null ||
                isDragging ||
                liliana.style.display === "none"
            ) {
                stopSittingAnimation();
                return;
            }

            sittingFrameIndex = (sittingFrameIndex + 1) % sittingFrames.length;
            petImage.src = sittingFrames[sittingFrameIndex];
            applyScale(imageScale.sitting);
        }, 2000);
    }

    /**
     * @param {"sitting" | "sittingFall" | "standing" | "dragging" | "falling" | "left" | "right"} pose
     */
    function setPose(pose) {
        if (!petImages[pose]) {
            console.error("Invalid pose:", pose);
            return;
        }

        petState.pose = pose;
        petImage.src = petImages[pose];
        applyScale(imageScale[pose] ?? 1);
        liliana.className = `pet ${pose}`;
        petVisual.className = `pet ${pose}`;
    }

    setPose("standing");

    let interactionTimer = null;

    /**
     * @param {"head" | "ear" | "body" | "tail" | "doubleClick" | "drag"} action
     */
    function interact(action) {
        const interactionImages = {
            head: assetUrl("asset/interaction/clickHead.png"),
            body: assetUrl("asset/interaction/clickBody.png"),
            tail: assetUrl("asset/interaction/clickTail.png"),
            ear: assetUrl("asset/interaction/clickEar.png"),
            doubleClick: assetUrl("asset/interaction/doubleClick.png"),
            drag: assetUrl("asset/interaction/drag.png"),
        };

        const imagePath = interactionImages[action];
        if (!imagePath) {
            console.error("Unknown interaction:", action);
            return;
        }

        petState.interaction = action;
        petImage.src = imagePath;
        applyScale(imageScale.interaction);
        liliana.classList.add("interacting");
        petVisual.classList.add("interacting");

        clearTimeout(interactionTimer);
        interactionTimer = setTimeout(() => {
            petState.interaction = null;
            liliana.classList.remove("interacting");
            petVisual.classList.remove("interacting");
            setPose("standing");
        }, 4000);
    }

    hitboxes.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (!action) return;

        stopWalking();
        stopSittingAnimation();
        stopSittingFall();
        clearTimeout(standingTimer)
        interact(action);
    });

    petVisual.addEventListener("dblclick", () => {
        clearTimeout(interactionTimer);
        clearTimeout(standingTimer)
        petState.interaction = null;
        liliana.classList.remove("interacting");
        petVisual.classList.remove("interacting");
        stopSittingFall();

        const nextPose = petState.pose === "standing" ? "sitting" : "standing";
        setPose(nextPose);
        if (nextPose === "sitting") {
            stopWalking();
            startSittingAnimation();
        } else {
            stopWalking();
            stopSittingAnimation();
        }
    });

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    const DRAG_THRESHOLD = 5;

    petVisual.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;

        const visualRect = petVisual.getBoundingClientRect();
        const minPullY = visualRect.top + visualRect.height * 0.25;
        if (
            event.clientX < visualRect.left ||
            event.clientX > visualRect.right ||
            event.clientY < minPullY ||
            event.clientY > visualRect.bottom
        ) {
            return;
        }

        const petRect = liliana.getBoundingClientRect();
        isPointerDown = true;
        isDragging = false;
        startX = event.clientX;
        startY = event.clientY;
        offsetX = event.clientX - petRect.left;
        offsetY = event.clientY - petRect.top;
    });

    window.addEventListener("pointermove", (event) => {
        if (!isPointerDown) return;

        const moveX = Math.abs(event.clientX - startX);
        const moveY = Math.abs(event.clientY - startY);

        if (!isDragging && (moveX > DRAG_THRESHOLD || moveY > DRAG_THRESHOLD)) {
            clearTimeout(interactionTimer);
            petState.interaction = null;
            liliana.classList.remove("interacting");
            petVisual.classList.remove("interacting");
            stopSittingFall();
            clearTimeout(standingTimer)
            isDragging = true;
            petState.isDragging = true;
            liliana.classList.add("dragging");
            petVisual.classList.add("dragging");
            setPose("dragging");

            const petRect = liliana.getBoundingClientRect();
            liliana.style.transform = "none";
            liliana.style.bottom = "auto";
            liliana.style.left = `${petRect.left}px`;
            liliana.style.top = `${petRect.top}px`;
        }

        if (!isDragging) return;

        const petRect = liliana.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - petRect.width);
        const maxTop = Math.max(0, window.innerHeight - petRect.height);

        const nextLeft = Math.min(Math.max(0, event.clientX - offsetX), maxLeft);
        const nextTop = Math.min(Math.max(0, event.clientY - offsetY), maxTop);

        liliana.style.left = `${nextLeft}px`;
        liliana.style.top = `${nextTop}px`;
    });

    function stopDrag() {
        if (!isPointerDown) return;

        isPointerDown = false;
        liliana.classList.remove("dragging");
        petVisual.classList.remove("dragging");

        if (isDragging) {
            setTimeout(() => {
                isDragging = false;
                petState.isDragging = false;
                stopWalking();
                startFalling();
            }, 0);
        }
    }

    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    hitboxes.addEventListener("click", (event) => {
        if (isDragging) {
            event.stopImmediatePropagation();
        }
    }, true);

    let fallAnimationId = null;
    let velocityY = 0;
    const GRAVITY = 0.35;

    function stopFalling() {
        if (fallAnimationId !== null) {
            cancelAnimationFrame(fallAnimationId);
            fallAnimationId = null;
        }
        velocityY = 0;
        hitboxes.style.pointerEvents = "auto";
    }

    let sittingFallTimer = null;

    function stopSittingFall() {
        if (sittingFallTimer !== null) {
            clearTimeout(sittingFallTimer);
            sittingFallTimer = null;
        }
    }
    let standingTimer = null
    function stopStandingTimer() {
        if (standingTimer !== null) {
            clearTimeout(standingTimer);
            standingTimer = null;
        }
    }

    /**
     * @param {function} onComplete
     */
    function startSittingFall(onComplete) {
        stopSittingFall();
        stopStandingTimer();
        setPose("sittingFall");
        hitboxes.style.pointerEvents = "auto";

        sittingFallTimer = setTimeout(() => {
            sittingFallTimer = null;
            if (isDragging || petState.pose !== "sittingFall" || liliana.style.display === "none") return;

            setPose("standing");
            standingTimer = setTimeout(() => {
                standingTimer = null;
                if (
                    isDragging ||
                    petState.interaction !== null ||
                    petState.pose !== "standing" ||
                    liliana.style.display === "none"
                ) {
                    return;
                }
                if (typeof onComplete === "function") {
                    onComplete();
                }
            }, 1000);
        }, 1500);
    }

    function startFalling() {
        stopFalling();
        stopSittingFall();
        setPose("falling");
        hitboxes.style.pointerEvents = "none";

        const step = () => {
            if (isDragging) return;

            const rect = liliana.getBoundingClientRect();
            const maxTop = Math.max(0, window.innerHeight - rect.height);

            velocityY += GRAVITY;
            let nextTop = rect.top + velocityY;

            if (nextTop >= maxTop) {
                nextTop = maxTop;
                liliana.style.top = `${nextTop}px`;
                stopFalling();
                startSittingFall(() => {
                    startWalking();
                });
                return;
            }

            liliana.style.top = `${nextTop}px`;
            fallAnimationId = requestAnimationFrame(step);
        };

        fallAnimationId = requestAnimationFrame(step);
    }

    let walkAnimationId = null;
    let walkDecisionTimer = null;
    const WALK_SPEED = 0.6;

    function canWalk() {
        return (
            !isDragging &&
            fallAnimationId === null &&
            sittingFallTimer === null &&
            petState.interaction === null &&
            petState.pose !== "sitting" &&
            petState.pose !== "sittingFall"
        );
    }

    function stopWalking(nextPose = null) {
        if (walkAnimationId !== null) {
            cancelAnimationFrame(walkAnimationId);
            walkAnimationId = null;
        }
        clearTimeout(walkDecisionTimer);
        walkDecisionTimer = null;
        petState.direction = "idle";

        if (nextPose) {
            setPose(nextPose);
        }
    }

    function scheduleNextWalkStep() {
        clearTimeout(walkDecisionTimer);

        walkDecisionTimer = setTimeout(() => {
            if (!canWalk()) {
                scheduleNextWalkStep();
                return;
            }

            if (Math.random() < 0.5) {
                stopWalking("standing");
                walkDecisionTimer = setTimeout(() => {
                    startWalking();
                }, 10000);
            } else {
                const directions = ["left", "right"];
                petState.direction = directions[Math.floor(Math.random() * directions.length)];
                setPose(`${petState.direction}`);
                startWalking();
            }
        }, 4000);
    }

    function startWalking() {
        if (!canWalk()) return;

        if (walkAnimationId !== null) {
            cancelAnimationFrame(walkAnimationId);
        }
        if (petState.direction !== "left" && petState.direction !== "right") {
            petState.direction = Math.random() < 0.5 ? "left" : "right";
            setPose(`${petState.direction}`);
        }

        const currentRect = liliana.getBoundingClientRect();
        liliana.style.transform = "none";
        liliana.style.left = `${currentRect.left}px`;

        scheduleNextWalkStep();

        const step = () => {
            if (!canWalk() || (petState.direction !== "left" && petState.direction !== "right")) {
                walkAnimationId = null;
                return;
            }

            const rect = liliana.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const delta = petState.direction === "right" ? WALK_SPEED : -WALK_SPEED;
            let nextLeft = rect.left + delta;

            if (nextLeft <= 0) {
                nextLeft = 0;
                petState.direction = "right";
                setPose("right");
            } else if (nextLeft >= maxLeft) {
                nextLeft = maxLeft;
                petState.direction = "left";
                setPose("left");
            }

            liliana.style.left = `${nextLeft}px`;
            walkAnimationId = requestAnimationFrame(step);
        };

        walkAnimationId = requestAnimationFrame(step);
    }

    window.addEventListener("resize", () => {
        if (liliana.style.display === "none") return;

        const rect = liliana.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        if (liliana.style.left !== "") {
            const clampedLeft = Math.min(Math.max(0, rect.left), maxLeft);
            liliana.style.left = `${clampedLeft}px`;
        }

        if (liliana.style.top !== "") {
            const clampedTop = Math.min(Math.max(0, rect.top), maxTop);
            liliana.style.top = `${clampedTop}px`;

            if (!isDragging && fallAnimationId === null && sittingFallTimer === null && clampedTop < maxTop - 1) {
                startFalling();
            }
        }
    });

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(
            /**
             * @param {{ type?: "LILIANA_TOGGLE_VISIBLE" | "LILIANA_SUMMON" | "LILIANA_TOGGLE_SIT" }} msg
             */
            (msg) => {
                if (!msg?.type) return;

                if (msg.type === "LILIANA_TOGGLE_VISIBLE") {
                    const isHidden = liliana.style.display === "none";
                    liliana.style.display = isHidden ? "" : "none";

                    if (!isHidden) {
                        stopWalking();
                        stopSittingAnimation();
                        stopSittingFall();
                        clearTimeout(standingTimer)
                        if (fallAnimationId !== null) {
                            cancelAnimationFrame(fallAnimationId);
                            fallAnimationId = null;
                            velocityY = 0;
                            hitboxes.style.pointerEvents = "auto";
                        }
                    }
                }

                if (msg.type === "LILIANA_SUMMON") {
                    liliana.style.display = "";
                    clearTimeout(interactionTimer);
                    petState.interaction = null;
                    liliana.classList.remove("interacting");
                    petVisual.classList.remove("interacting");
                    stopSittingFall();
                    stopStandingTimer();
                    stopWalking();

                    const rect = liliana.getBoundingClientRect();
                    const centerLeft = Math.max(0, (window.innerWidth - rect.width) / 2);
                    const startTop = Math.max(0, Math.min(80, window.innerHeight - rect.height));

                    liliana.style.transform = "none";
                    liliana.style.bottom = "auto";
                    liliana.style.left = `${centerLeft}px`;
                    liliana.style.top = `${startTop}px`;

                    startFalling();
                }

                if (msg.type === "LILIANA_TOGGLE_SIT") {
                    liliana.style.display = "";
                    clearTimeout(interactionTimer);
                    petState.interaction = null;
                    liliana.classList.remove("interacting");
                    petVisual.classList.remove("interacting");
                    stopSittingFall();
                    clearTimeout(standingTimer)

                    if (fallAnimationId !== null) {
                        cancelAnimationFrame(fallAnimationId);
                        fallAnimationId = null;
                        velocityY = 0;
                        hitboxes.style.pointerEvents = "auto";
                    }

                    const nextPose = petState.pose === "sitting" ? "standing" : "sitting";
                    setPose(nextPose);
                    if (nextPose === "sitting") {
                        stopWalking();
                        startSittingAnimation();
                    } else {
                        startWalking();
                        stopSittingAnimation();
                    }
                }
            }
        );
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLiliana);
} else {
    initLiliana();
}
