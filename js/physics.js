/* ==========================================================================
   HILL CLIMB RACING EXTREME - 2D PHYSICS ENGINE (js/physics.js)
   ========================================================================== */

class VehiclePhysics {
    constructor(config = {}) {
        // Vehicle Config Parameters (overridden by vehicle stats/upgrades)
        this.vehicleId = config.id || 'jeep';    // Used by renderer to pick the right draw fn
        this.color = config.color || '#e74c3c';  // Vehicle body colour
        this.weight = config.weight || 1.0;
        this.enginePower = config.enginePower || 1.0;
        this.suspensionStiffness = config.suspensionStiffness || 1.0;
        this.tireGrip = config.tireGrip || 1.0;
        this.wheelRadius = config.wheelRadius || 18;
        this.chassisWidth = config.chassisWidth || 70;
        this.chassisHeight = config.chassisHeight || 30;

        // Position & Velocities
        this.x = 200;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;

        // Drivers Head Position
        this.headOffset = { x: -4, y: -28 };

        // Wheels state (Relative to chassis center - properly spaced rear & front)
        this.rearWheel = { x: -35, y: 16, vx: 0, vy: 0, grounded: false, rot: 0, angVel: 0 };
        this.frontWheel = { x: 35, y: 16, vx: 0, vy: 0, grounded: false, rot: 0, angVel: 0 };

        // Controls input state
        this.gasInput = 0;   // 0 to 1
        this.brakeInput = 0; // 0 to 1
        this.throttle = 0;   // Smooth throttle interpolation

        // Air flips tracker
        this.isGrounded = false;
        this.airRotation = 0;
        this.lastAngle = 0;
        this.flipsCompleted = 0;
        this.isCrashed = false;
    }

    reset(startX, startY) {
        this.x = startX;
        this.y = startY;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;

        this.rearWheel.rot = 0;
        this.rearWheel.angVel = 0;
        this.frontWheel.rot = 0;
        this.frontWheel.angVel = 0;

        this.gasInput = 0;
        this.brakeInput = 0;
        this.throttle = 0;
        this.isGrounded = false;
        this.airRotation = 0;
        this.lastAngle = 0;
        this.flipsCompleted = 0;
        this.isCrashed = false;
    }

    update(dt, gravity, getTerrainHeightFn) {
        if (this.isCrashed) return;

        // Smooth throttle response - slower ramp-up for better control
        this.throttle += (this.gasInput - this.throttle) * 0.08;

        // 1. Apply Gravity
        this.vy += gravity * dt * 60;

        // 2. Air Torque Controls (Gentle, controllable tilt)
        const airTorque = 0.022 * (this.gasInput - this.brakeInput);
        if (!this.rearWheel.grounded && !this.frontWheel.grounded) {
            this.angularVelocity += airTorque * dt * 60;
        } else {
            // Gentle ground angle adjustment
            this.angularVelocity += airTorque * 0.12 * dt * 60;
        }

        // Damping for smooth handling
        this.angularVelocity *= 0.92;
        this.vx *= 0.985;
        this.vy *= 0.99;

        // Speed limiter — prevent runaway acceleration
        const maxSpeed = 6.5 * this.enginePower;
        if (Math.abs(this.vx) > maxSpeed) {
            this.vx = Math.sign(this.vx) * maxSpeed;
        }

        // Integrate positions
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.angle += this.angularVelocity * dt * 60;

        // Spin wheels: positive vx = forward = clockwise rotation (positive angle)
        // For a side-view vehicle moving right, wheels rotate clockwise (positive)
        const wheelAngVel = this.vx * 0.055;
        this.rearWheel.rot += wheelAngVel;
        this.frontWheel.rot += wheelAngVel;

        // 3. Calculate Wheel Positions in World Coordinates
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        const rWorld = {
            x: this.x + (this.rearWheel.x * cos - this.rearWheel.y * sin),
            y: this.y + (this.rearWheel.x * sin + this.rearWheel.y * cos)
        };
        const fWorld = {
            x: this.x + (this.frontWheel.x * cos - this.frontWheel.y * sin),
            y: this.y + (this.frontWheel.x * sin + this.frontWheel.y * cos)
        };

        // 4. Wheel Collision & Suspension Springs
        this.rearWheel.grounded = this.processWheelCollision(rWorld, true, getTerrainHeightFn, dt);
        this.frontWheel.grounded = this.processWheelCollision(fWorld, false, getTerrainHeightFn, dt);

        this.isGrounded = this.rearWheel.grounded || this.frontWheel.grounded;

        // 5. Air Flip Tracker & Rewards
        let trickResult = null;
        if (!this.isGrounded) {
            let dAngle = this.angle - this.lastAngle;
            while (dAngle > Math.PI) dAngle -= Math.PI * 2;
            while (dAngle < -Math.PI) dAngle += Math.PI * 2;

            this.airRotation += dAngle;

            if (Math.abs(this.airRotation) >= Math.PI * 1.85) {
                this.flipsCompleted++;
                const isBackflip = this.airRotation > 0;
                trickResult = isBackflip ? "BACKFLIP +200 🪙" : "FRONTFLIP +200 🪙";
                this.airRotation = 0;
            }
        } else {
            this.airRotation = 0;
        }
        this.lastAngle = this.angle;

        // 6. Driver Neck Crash Check
        const headWorldX = this.x + (this.headOffset.x * cos - this.headOffset.y * sin);
        const headWorldY = this.y + (this.headOffset.x * sin + this.headOffset.y * cos);
        const groundAtHead = getTerrainHeightFn(headWorldX);

        if (headWorldY >= groundAtHead - 8) {
            this.isCrashed = true;
            trickResult = "NECK FLIP CRASH!";
        }

        return trickResult;
    }

    processWheelCollision(wheelWorldPos, isRear, getTerrainHeightFn, dt) {
        const terrainY = getTerrainHeightFn(wheelWorldPos.x);
        const depth = (wheelWorldPos.y + this.wheelRadius) - terrainY;

        if (depth > 0) {
            // Calculate slope angle
            const deltaX = 4;
            const y1 = getTerrainHeightFn(wheelWorldPos.x - deltaX);
            const y2 = getTerrainHeightFn(wheelWorldPos.x + deltaX);
            const slopeAngle = Math.atan2(y2 - y1, deltaX * 2);

            const normal = { x: -Math.sin(slopeAngle), y: Math.cos(slopeAngle) };
            const tangent = { x: Math.cos(slopeAngle), y: Math.sin(slopeAngle) };

            // Suspension spring force
            const springStiffness = 0.22 * this.suspensionStiffness;
            const springForceY = depth * springStiffness;
            this.vy -= springForceY * normal.y;
            this.vx -= springForceY * normal.x;
            this.y -= depth * 0.45; // Soft ground push

            // Smooth drive torque application - reduced for controllable climbing speed
            const driveForce = (this.throttle - (this.brakeInput * 0.8)) * 0.13 * this.enginePower;
            
            // Grip multiplier: less grip on steeper slopes
            const slopeFactor = Math.max(0.3, 1.0 - Math.abs(Math.sin(slopeAngle)) * 0.4);
            this.vx += tangent.x * driveForce * slopeFactor;
            this.vy += tangent.y * driveForce * slopeFactor;

            // Apply rotation torque to chassis to align smoothly with terrain slope
            const angleDiff = this.angle - slopeAngle;
            this.angularVelocity -= angleDiff * 0.035;

            return true;
        }

        return false;
    }
}
