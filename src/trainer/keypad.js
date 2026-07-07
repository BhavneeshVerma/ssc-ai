// Virtual Keypad Module

export function initializeKeypad(inputElement, submitCallback) {
    const numpad = document.getElementById("numpadGrid");
    const alphapad = document.getElementById("alphapadGrid");
    
    if (!numpad || !alphapad) {
        console.warn("Virtual keypads not found in the DOM.");
        return;
    }
    
    const keypadPressHandler = (e) => {
        const keyBtn = e.target.closest(".key-btn");
        if (!keyBtn) return;
        
        // Prevent default touch/click browser reactions (keeps browser soft keyboard suppressed)
        e.preventDefault();
        
        const key = keyBtn.getAttribute("data-key");
        
        // Visual button press animation
        keyBtn.classList.add("active");
        setTimeout(() => keyBtn.classList.remove("active"), 100);
        
        if (inputElement.disabled) return;
        
        if (key === "backspace") {
            inputElement.value = inputElement.value.slice(0, -1);
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (key === "enter") {
            if (inputElement.value.trim() !== "") {
                submitCallback();
            }
        } else {
            // Append key value to the text input
            inputElement.value += key;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Focus the input to keep blinking cursor active on visual display.
        // preventScroll prevents viewport jumping.
        inputElement.focus({ preventScroll: true });
    };
    
    // Listen to pointerdown for instant, zero-delay touch/mouse clicks
    numpad.addEventListener("pointerdown", keypadPressHandler);
    alphapad.addEventListener("pointerdown", keypadPressHandler);
}

// Adjust virtual keypad layout depending on workout mode
export function updateKeypadVisibility(mode) {
    const numpad = document.getElementById("numpadGrid");
    const alphapad = document.getElementById("alphapadGrid");
    
    if (!numpad || !alphapad) return;
    
    if (mode === "tables") {
        numpad.style.display = "grid";
        alphapad.style.display = "none";
    } else {
        if (mode === "numToAlpha" || mode === "alphaOpposite") {
            numpad.style.display = "none";
            alphapad.style.display = "flex";
        } else {
            numpad.style.display = "grid";
            alphapad.style.display = "none";
        }
    }
}
