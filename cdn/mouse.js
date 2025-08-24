(function() {
  function initCustomCursor() {
    // --- Inject HTML ---
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");

    const follower = document.createElement("div");
    follower.className = "cursor-follower";
    follower.setAttribute("aria-hidden", "true");

    document.body.appendChild(cursor);
    document.body.appendChild(follower);

    // --- Inject CSS ---
    const style = document.createElement("style");
    style.textContent = `
      * { cursor: none; }
      .cursor, .cursor-follower {
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        z-index: 9999;
        will-change: transform;
      }
      .cursor {
        width: 10px;
        height: 10px;
        background: #ffffff;
        mix-blend-mode: difference;
        transition: width .18s, height .18s;
      }
      .cursor-follower {
        width: 30px;
        height: 30px;
        border: 2px solid #ffffff;
        opacity: .55;
        transition: opacity .25s;
      }
      .cursor.grow {
        width: 28px;
        height: 28px;
      }
      .cursor-follower.hide {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);

    // --- JS Logic ---
    let mouseX = 0, mouseY = 0;
    let fx = 0, fy = 0;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function animate(){
      cursor.style.transform = "translate(-50%, -50%) translate(" + mouseX + "px, " + mouseY + "px)";
      fx += (mouseX - fx) * 0.12;
      fy += (mouseY - fy) * 0.12;
      follower.style.transform = "translate(-50%, -50%) translate(" + fx + "px, " + fy + "px)";
      requestAnimationFrame(animate);
    }
    animate();

    document.querySelectorAll("a, button, .btn").forEach(el => {
      el.addEventListener("mouseenter", () => {
        cursor.classList.add("grow");
        follower.classList.add("hide");
      });
      el.addEventListener("mouseleave", () => {
        cursor.classList.remove("grow");
        follower.classList.remove("hide");
      });
    });
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomCursor);
  } else {
    initCustomCursor();
  }
})();
