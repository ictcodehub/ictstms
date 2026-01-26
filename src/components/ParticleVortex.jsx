import { useEffect, useRef } from 'react';

const ParticleVortex = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let particles = [];

        // Configuration
        const particleCount = 100;
        const connectionDistance = 100;
        const mouseDistance = 150;

        let mouse = { x: null, y: null };

        // Handle resize
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                // Vortex velocity
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                // Increased size for visibility
                this.size = Math.random() * 3 + 2;
                this.baseX = this.x;
                this.baseY = this.y;
                this.density = (Math.random() * 30) + 1;
                // Maximum opacity
                this.color = `rgba(255, 255, 255, 1)`;
            }

            update() {
                // Gentle vortex movement
                this.x += this.vx;
                this.y += this.vy;

                // Mouse interaction (Vortex distortion)
                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < mouseDistance) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const maxDistance = mouseDistance;
                        const force = (maxDistance - distance) / maxDistance;
                        const directionX = forceDirectionX * force * this.density * 0.6; // Push factor
                        const directionY = forceDirectionY * force * this.density * 0.6;

                        this.x -= directionX;
                        this.y -= directionY;
                    }
                }

                // Boundary check - wrap around
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            }

            draw() {
                ctx.fillStyle = this.color;
                // Add shadow for better contrast against light background
                ctx.shadowBlur = 4;
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
                // Reset shadow to avoid affecting other elements if needed (though we clear whole canvas)
                ctx.shadowBlur = 0;
            }
        }

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const canvasConnect = () => {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    let dx = particles[a].x - particles[b].x;
                    let dy = particles[a].y - particles[b].y;
                    let distance = dx * dx + dy * dy;

                    if (distance < (connectionDistance * connectionDistance)) {
                        let opacityValue = 1 - (distance / (connectionDistance * connectionDistance));
                        // High visibility white lines with increased thickness
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue})`;
                        ctx.lineWidth = 2; // Thicker lines
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            canvasConnect();
            animationFrameId = requestAnimationFrame(animate);
        };

        // Event Listeners
        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });
        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        // Init
        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full z-0 opacity-60"
        />
    );
};

export default ParticleVortex;
