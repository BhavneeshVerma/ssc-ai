// HTML5 2D Canvas Analytics Drawing Module

export function drawMistakeChart(canvas, data, labelPrefix) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Scale for Retina/High-DPI screen displays to ensure sharpness
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    
    // Query theme variables dynamically from computed styles
    const computedStyles = getComputedStyle(document.body);
    const bgPanel = computedStyles.getPropertyValue('--bg-panel').trim() || '#11141B';
    const textMain = computedStyles.getPropertyValue('--text-main').trim() || '#E9ECF0';
    const textMuted = computedStyles.getPropertyValue('--text-muted').trim() || '#8F9BA8';
    const primary = computedStyles.getPropertyValue('--primary').trim() || '#00E5FF';
    const danger = computedStyles.getPropertyValue('--danger').trim() || '#F43F5E';
    const dangerHover = computedStyles.getPropertyValue('--danger-hover').trim() || '#E11D48';
    const border = computedStyles.getPropertyValue('--border').trim() || 'rgba(255, 255, 255, 0.05)';
    
    // Fill background matching CSS theme variables
    ctx.fillStyle = bgPanel;
    ctx.fillRect(0, 0, width, height);
    
    if (data.length === 0) {
        ctx.fillStyle = textMuted;
        ctx.font = "14px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Start practicing! When you make mistakes, they will show up here.", width / 2, height / 2);
        return;
    }
    
    const chartData = data.slice(0, 15); // Top 15 max
    const padding = { top: 45, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxVal = Math.max(...chartData.map(d => d.count)) || 1;
    
    // Draw Y-axis gridlines & values
    const gridLinesCount = Math.min(maxVal, 5);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.fillStyle = textMuted;
    ctx.font = "10px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    for (let i = 0; i <= gridLinesCount; i++) {
        const val = Math.round((maxVal / gridLinesCount) * i);
        const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
        
        // Grid lines
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        
        // Value labels
        ctx.fillText(val.toString(), padding.left - 10, y);
    }
    
    // Draw Bars
    const barWidth = (chartWidth / chartData.length) * 0.6;
    const barGap = (chartWidth / chartData.length) * 0.4;
    
    chartData.forEach((item, index) => {
        const barHeight = (item.count / maxVal) * chartHeight;
        const x = padding.left + (index * (barWidth + barGap)) + (barGap / 2);
        const y = padding.top + chartHeight - barHeight;
        
        // Linear gradient fill
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, danger);
        gradient.addColorStop(1, dangerHover);
        ctx.fillStyle = gradient;
        
        // Round top corners of bar
        const radius = Math.min(barWidth / 3, 6);
        ctx.beginPath();
        ctx.moveTo(x, y + barHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + barHeight);
        ctx.closePath();
        ctx.fill();
        
        // Text labels for bars (bottom)
        ctx.fillStyle = textMain;
        ctx.font = "11px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const displayLabel = item.key;
        ctx.fillText(displayLabel, x + barWidth / 2, padding.top + chartHeight + 8);
        
        // Mistake values on top of bar
        if (barHeight > 18) {
            ctx.fillStyle = textMain;
            ctx.font = "bold 9px Outfit, sans-serif";
            ctx.textBaseline = "bottom";
            ctx.fillText(item.count.toString(), x + barWidth / 2, y - 4);
        }
    });
    
    // Title
    ctx.fillStyle = primary;
    ctx.font = "600 13px Outfit, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Top ${chartData.length} Mistakes (${labelPrefix} Frequency)`, padding.left, 12);
}
