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

// Adjust virtual keypad layout depending on workout mode and expected answer content
export function updateKeypadVisibility(mode, expectedAnswer) {
    const numpad = document.getElementById("numpadGrid");
    const alphapad = document.getElementById("alphapadGrid");
    const alphapadNumRow = document.getElementById("alphapadNumRow");
    
    if (!numpad || !alphapad) return;
    
    // Determine the required keyboard type: "numeric", "alpha", or "alphanumeric"
    let keyboardType = "numeric"; // default fallback
    
    if (expectedAnswer) {
        const cleanAnswer = expectedAnswer.trim();
        const isNumeric = /^[0-9]+$/.test(cleanAnswer);
        const isAlphabetic = /^[A-Za-z]+$/.test(cleanAnswer);
        
        if (isNumeric) {
            keyboardType = "numeric";
        } else if (isAlphabetic) {
            keyboardType = "alpha";
        } else if (cleanAnswer.length > 0) {
            keyboardType = "alphanumeric";
        } else {
            // Empty string fallback to mode
            if (mode === "numToAlpha" || mode === "alphaOpposite") {
                keyboardType = "alpha";
            } else if (mode === "alphaToNum" || mode === "tables") {
                keyboardType = "numeric";
            } else {
                keyboardType = "alphanumeric";
            }
        }
    } else {
        // Fallback when expectedAnswer is not provided (e.g. initial load or setup)
        if (mode === "numToAlpha" || mode === "alphaOpposite") {
            keyboardType = "alpha";
        } else if (mode === "alphaToNum" || mode === "tables") {
            keyboardType = "numeric";
        } else {
            keyboardType = "alphanumeric";
        }
    }
    
    // Apply layout changes
    if (keyboardType === "numeric") {
        numpad.style.display = "grid";
        alphapad.style.display = "none";
        if (alphapadNumRow) alphapadNumRow.style.display = "none";
    } else if (keyboardType === "alpha") {
        numpad.style.display = "none";
        alphapad.style.display = "flex";
        if (alphapadNumRow) alphapadNumRow.style.display = "none";
    } else if (keyboardType === "alphanumeric") {
        numpad.style.display = "none";
        alphapad.style.display = "flex";
        if (alphapadNumRow) {
            alphapadNumRow.style.display = "flex";
            alphapadNumRow.style.flexDirection = "row";
        }
    }
}
