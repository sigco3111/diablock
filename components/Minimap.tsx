
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ActiveMonster, AttackEvent, Player, SkillProcEvent, ThreeDPosition } from '../types.ts'; 
import { tailwindToHex } from '../utils/colorUtils.ts';
import { PLAYER_ID, GAME_CONFIG } from '../diablockConstants.ts';

interface MinimapProps {
  player: Player;
  monsters: ActiveMonster[];
  attackEvents: AttackEvent[];
  skillProcEvents: SkillProcEvent[];
}

const getSizeClassScale = (sizeClass?: string): number => {
  if (!sizeClass) return 1.0;
  const match = sizeClass.match(/w-(\d+)/);
  if (match && match[1]) {
    const widthNum = parseInt(match[1], 10);
    return widthNum / 10.0;
  }
  return 1.0;
};

function tweenPosition(mesh: THREE.Mesh, targetPosition: THREE.Vector3, duration: number, onComplete?: () => void) {
    if (!mesh || !mesh.parent) {
        if (onComplete) onComplete();
        return;
    }
    const startPosition = mesh.position.clone();
    const startTime = Date.now();

    function animateTween() {
        if (!mesh || !mesh.parent) {
            return;
        }
        const now = Date.now();
        const elapsedTime = now - startTime;
        let progress = Math.min(elapsedTime / duration, 1);

        progress = 1 - Math.pow(1 - progress, 3);

        mesh.position.lerpVectors(startPosition, targetPosition, progress);

        if (progress < 1) {
            requestAnimationFrame(animateTween);
        } else {
            mesh.position.copy(targetPosition);
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(animateTween);
}

interface ActiveParticleSystem {
    id: string;
    points: THREE.Points;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
    startTime: number;
    duration: number;
    update: () => boolean; 
    skillId?: string; 
}
const activeParticleSystems: ActiveParticleSystem[] = [];

function createParticleEffect(
    scene: THREE.Scene,
    skillId: string,
    sourcePos: THREE.Vector3,
    targetPos?: THREE.Vector3, 
    color: THREE.ColorRepresentation = 0xffffff,
    count: number = 50,
    size: number = 0.1,
    duration: number = 1000, 
    particleSpeed: number = 0.05
) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const alphas = new Float32Array(count);


    for (let i = 0; i < count; i++) {
        positions[i * 3] = sourcePos.x;
        positions[i * 3 + 1] = sourcePos.y + 0.2; 
        positions[i * 3 + 2] = sourcePos.z;

        if (skillId === 'quake_stomp') {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1.5;
            velocities[i * 3] = Math.cos(angle) * radius * 0.03; 
            velocities[i * 3 + 1] = Math.random() * 0.05 + 0.02; 
            velocities[i * 3 + 2] = Math.sin(angle) * radius * 0.03; 
        } else if (skillId === 'thorns_aura' && targetPos) {
            const dir = new THREE.Vector3().subVectors(targetPos, sourcePos).normalize();
            velocities[i * 3] = dir.x * particleSpeed * (Math.random() * 0.5 + 0.5);
            velocities[i * 3 + 1] = dir.y * particleSpeed * (Math.random() * 0.5 + 0.5) + (Math.random() -0.5) * 0.02; 
            velocities[i * 3 + 2] = dir.z * particleSpeed * (Math.random() * 0.5 + 0.5);
        } else if (targetPos && (skillId === 'power_strike' || skillId === 'crushing_impact')) { 
             positions[i * 3] = targetPos.x;
             positions[i * 3 + 1] = targetPos.y + 0.2;
             positions[i * 3 + 2] = targetPos.z;
             velocities[i * 3] = (Math.random() - 0.5) * particleSpeed * 2;
             velocities[i * 3 + 1] = (Math.random() - 0.5) * particleSpeed * 2;
             velocities[i * 3 + 2] = (Math.random() - 0.5) * particleSpeed * 2;
        }
         else { 
            velocities[i * 3] = (Math.random() - 0.5) * particleSpeed * 2;
            velocities[i * 3 + 1] = (Math.random()) * particleSpeed * 1.5; 
            velocities[i * 3 + 2] = (Math.random() - 0.5) * particleSpeed * 2;
        }
        alphas[i] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1)); 

    const material = new THREE.PointsMaterial({
        color: color,
        size: size,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        depthWrite: false, 
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const systemId = `particle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeParticleSystems.push({
        id: systemId,
        points,
        geometry,
        material,
        startTime: Date.now(),
        duration,
        skillId,
        update: function () {
            const elapsedTime = Date.now() - this.startTime;
            if (elapsedTime >= this.duration) {
                scene.remove(this.points);
                this.geometry.dispose();
                this.material.dispose();
                return false; 
            }

            const progress = elapsedTime / this.duration;
            this.material.opacity = 1.0 - progress; 

            const posAttribute = this.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < count; i++) {
                posAttribute.array[i * 3] += velocities[i * 3];
                posAttribute.array[i * 3 + 1] += velocities[i * 3 + 1];
                posAttribute.array[i * 3 + 2] += velocities[i * 3 + 2];
                
                if (skillId !== 'quake_stomp') { 
                     velocities[i * 3 + 1] -= 0.001; 
                }
            }
            posAttribute.needsUpdate = true;
            return true; 
        },
    });
}


const Minimap: React.FC<MinimapProps> = ({ player, monsters, attackEvents, skillProcEvents }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const monsterGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const initialResizeHandleRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  const monsterMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const processedAttackEventIdsRef = useRef(new Set<string>());
  const processedSkillProcEventIdsRef = useRef(new Set<string>());
  
  const [cameraPositionDisplay, setCameraPositionDisplay] = useState<{x: number, y: number, z: number} | null>(null);


  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;

    clockRef.current = new THREE.Clock(); 

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x374151); 
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth > 0 ? currentMount.clientWidth / currentMount.clientHeight : 1, 0.1, 1000);
    
    // Set camera position based on user's new screenshot
    const defaultX = -8.3;
    const defaultY = 5.8;
    const defaultZ = 8.2;
    camera.position.set(defaultX, defaultY, defaultZ); 
    
    cameraRef.current = camera;
    setCameraPositionDisplay({x: camera.position.x, y: camera.position.y, z: camera.position.z});


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth || 1, currentMount.clientHeight || 1); 
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0); // Ensure camera looks at the origin
    controls.minDistance = 2.5;
    controls.maxDistance = 25; 
    controls.minPolarAngle = Math.PI / 6; 
    controls.maxPolarAngle = Math.PI / 2 - Math.PI / 18; 
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const mapWidth = GAME_CONFIG.MAP_BOUNDS.maxX - GAME_CONFIG.MAP_BOUNDS.minX;
    const mapDepth = GAME_CONFIG.MAP_BOUNDS.maxZ - GAME_CONFIG.MAP_BOUNDS.minZ;
    const groundGeometry = new THREE.PlaneGeometry(mapWidth, mapDepth);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5568, side: THREE.DoubleSide }); 
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.05;
    scene.add(groundPlane);

    const playerGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4299e1 }); 
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    scene.add(playerMesh);
    playerMeshRef.current = playerMesh;

    const monsterGroup = new THREE.Group();
    scene.add(monsterGroup);
    monsterGroupRef.current = monsterGroup;

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current?.getDelta() || 0;
      
      controlsRef.current?.update(delta);
      
      if (cameraRef.current) {
        const { x, y, z } = cameraRef.current.position;
        setCameraPositionDisplay(prevPos => {
          if (prevPos && Math.abs(prevPos.x - x) < 0.01 && Math.abs(prevPos.y - y) < 0.01 && Math.abs(prevPos.z - z) < 0.01) {
            return prevPos;
          }
          return { x, y, z };
        });
      }

      for (let i = activeParticleSystems.length - 1; i >= 0; i--) {
        if (!activeParticleSystems[i].update()) {
            activeParticleSystems.splice(i, 1);
        }
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) { 
          rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (currentMount && rendererRef.current && cameraRef.current) {
        const width = currentMount.clientWidth;
        const height = currentMount.clientHeight;
        if (width > 0 && height > 0) {
            rendererRef.current.setSize(width, height);
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
        }
      }
    };
    window.addEventListener('resize', handleResize);
    initialResizeHandleRef.current = requestAnimationFrame(() => {
        handleResize();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (initialResizeHandleRef.current) {
        cancelAnimationFrame(initialResizeHandleRef.current);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      
      activeParticleSystems.forEach(system => { 
        if (sceneRef.current) sceneRef.current.remove(system.points);
        system.geometry.dispose();
        system.material.dispose();
      });
      activeParticleSystems.length = 0;

      controlsRef.current?.dispose();

      if (monsterGroupRef.current && sceneRef.current) {
        monsterGroupRef.current.children.slice().forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
          }
           monsterGroupRef.current?.remove(child);
        });
        sceneRef.current.remove(monsterGroupRef.current);
      }
      monsterMeshesRef.current.clear();

      if (playerMeshRef.current && sceneRef.current) {
        playerMeshRef.current.geometry.dispose();
        if(Array.isArray(playerMeshRef.current.material)) {
            playerMeshRef.current.material.forEach(m => m.dispose());
        } else {
            (playerMeshRef.current.material as THREE.Material).dispose();
        }
        sceneRef.current.remove(playerMeshRef.current);
      }

      groundGeometry.dispose();
      groundMaterial.dispose();
      if (sceneRef.current) sceneRef.current.remove(groundPlane);

      ambientLight.dispose();
      directionalLight.dispose();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentNode === currentMount) {
             currentMount?.removeChild(rendererRef.current.domElement);
        }
      }
      
      if (sceneRef.current) {
        sceneRef.current.background = null; 
        sceneRef.current.clear();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      playerMeshRef.current = null;
      monsterGroupRef.current = null;
      clockRef.current = null;
    };
  }, []); 

  useEffect(() => {
    if (playerMeshRef.current && player?.position) {
      playerMeshRef.current.position.set(player.position.x, player.position.y, player.position.z);
    }
  }, [player?.position]);


  useEffect(() => {
    if (!monsterGroupRef.current || !sceneRef.current) return;

    const existingMonsterIds = new Set<string>();
    monsters.forEach(monster => existingMonsterIds.add(monster.instanceId));

    monsterMeshesRef.current.forEach((mesh, id) => {
        if (!existingMonsterIds.has(id)) {
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
            monsterGroupRef.current?.remove(mesh);
            monsterMeshesRef.current.delete(id);
        }
    });
    
    monsters.forEach((monster) => {
      let monsterMesh = monsterMeshesRef.current.get(monster.instanceId);
      if (!monsterMesh) { 
        const monsterColorHex = tailwindToHex(monster.color);
        const scale = getSizeClassScale(monster.sizeClass);
        const baseDimension = 0.6;
        const monsterGeometry = new THREE.BoxGeometry(baseDimension * scale, baseDimension * scale, baseDimension * scale);
        const monsterMaterial = new THREE.MeshStandardMaterial({ color: monsterColorHex });
        monsterMesh = new THREE.Mesh(monsterGeometry, monsterMaterial);
        monsterGroupRef.current?.add(monsterMesh);
        monsterMeshesRef.current.set(monster.instanceId, monsterMesh);
      }
      if (monster.position && monsterMesh) {
         const targetPos = new THREE.Vector3(monster.position.x, monster.position.y, monster.position.z);
         if (!monsterMesh.position.equals(targetPos)) {
            monsterMesh.position.copy(targetPos);
         }
      } else if (monsterMesh && !monster.position) { 
        const scale = getSizeClassScale(monster.sizeClass);
        const baseDimension = 0.6;
        const yPos = (baseDimension * scale) / 2;
        monsterMesh.position.set(Math.random() * 5 - 2.5, yPos, Math.random() * 5 - 2.5);
      }
    });

  }, [monsters]);


  useEffect(() => {
    if (!sceneRef.current || !playerMeshRef.current || !monsterMeshesRef.current) return;

    attackEvents.forEach(event => {
        if (processedAttackEventIdsRef.current.has(event.id)) {
            return;
        }

        let attackerMesh: THREE.Mesh | undefined | null; 
        let targetMesh: THREE.Mesh | undefined | null;
        let attackerIsPlayer = false;

        if (event.attackerId === PLAYER_ID) {
            attackerMesh = playerMeshRef.current;
            attackerIsPlayer = true;
            targetMesh = monsterMeshesRef.current.get(event.targetId);
        } else {
            attackerMesh = monsterMeshesRef.current.get(event.attackerId);
            targetMesh = playerMeshRef.current;
        }

        if (targetMesh && targetMesh.material instanceof THREE.MeshStandardMaterial) {
            const material = targetMesh.material as THREE.MeshStandardMaterial;
            const originalEmissive = material.emissive.getHex();
            const effectColor = event.isCritical ? 0xffff00 : 0xff0000;

            material.emissive.setHex(effectColor);
            material.needsUpdate = true;

            setTimeout(() => {
                const currentTargetMesh = (event.targetId === PLAYER_ID)
                                      ? playerMeshRef.current
                                      : monsterMeshesRef.current.get(event.targetId);
                if (currentTargetMesh && currentTargetMesh.material instanceof THREE.MeshStandardMaterial && currentTargetMesh.material === material) {
                    material.emissive.setHex(originalEmissive);
                    material.needsUpdate = true;
                }
            }, 300);
        }

        if (attackerIsPlayer) {
            if (targetMesh && playerMeshRef.current) {
                const monsterOriginalPos = targetMesh.position.clone();
                const playerPos = playerMeshRef.current.position;
                const recoilDirection = targetMesh.position.clone().sub(playerPos).normalize();
                const recoilDistance = 0.25;
                const recoilPosition = monsterOriginalPos.clone().add(recoilDirection.multiplyScalar(recoilDistance));

                tweenPosition(targetMesh, recoilPosition, 75, () => {
                    tweenPosition(targetMesh, monsterOriginalPos, 75);
                });
            }
        } else if (attackerMesh && playerMeshRef.current) {
            const originalPosition = attackerMesh.position.clone();
            const directionToPlayer = playerMeshRef.current.position.clone().sub(attackerMesh.position).normalize();
            const lungeDistance = 0.35;
            const lungeTargetPosition = attackerMesh.position.clone().add(directionToPlayer.multiplyScalar(lungeDistance));

            tweenPosition(attackerMesh, lungeTargetPosition, 100, () => {
                tweenPosition(attackerMesh, originalPosition, 100);
            });
        }
        processedAttackEventIdsRef.current.add(event.id);
    });

    const currentAttackEventIdsInProp = new Set(attackEvents.map(e => e.id));
    processedAttackEventIdsRef.current.forEach(id => {
        if (!currentAttackEventIdsInProp.has(id)) {
            processedAttackEventIdsRef.current.delete(id);
        }
    });

  }, [attackEvents]);

   useEffect(() => {
    if (!sceneRef.current) return;

    skillProcEvents.forEach(event => {
        if (processedSkillProcEventIdsRef.current.has(event.id)) {
            return;
        }

        let effectPos: THREE.Vector3 | undefined;
        let targetEffectPos: THREE.Vector3 | undefined;

        if (event.position) {
            effectPos = new THREE.Vector3(event.position.x, event.position.y, event.position.z);
        } else if (event.sourceId === PLAYER_ID && playerMeshRef.current) {
            effectPos = playerMeshRef.current.position.clone();
        } else if (event.sourceId !== PLAYER_ID) {
            const sourceMesh = monsterMeshesRef.current.get(event.sourceId);
            if (sourceMesh) effectPos = sourceMesh.position.clone();
        }

        if (event.targetId === PLAYER_ID && playerMeshRef.current) {
            targetEffectPos = playerMeshRef.current.position.clone();
        } else if (event.targetId) {
            const targetMesh = monsterMeshesRef.current.get(event.targetId);
            if (targetMesh) targetEffectPos = targetMesh.position.clone();
        }

        if (!effectPos && targetEffectPos) effectPos = targetEffectPos; 
        if (!effectPos && !targetEffectPos && playerMeshRef.current) effectPos = playerMeshRef.current.position.clone(); 
        else if (!effectPos && !targetEffectPos) effectPos = new THREE.Vector3(0, GAME_CONFIG.PLAYER_Y_POSITION, 0);


        let particleColor: THREE.ColorRepresentation = event.color || 0xffffff;
        let particleCount = 50;
        let particleSize = 0.1;
        let particleDuration = 1000;
        let particleSpeed = 0.05;

        switch (event.skillId) {
            case 'power_strike':
                particleColor = event.color || 0xFFD700; 
                particleCount = 30;
                particleSize = 0.15;
                particleSpeed = 0.07;
                effectPos = targetEffectPos || effectPos; 
                break;
            case 'crushing_impact':
                particleColor = event.color || 0x808080; 
                particleCount = 40;
                particleSize = 0.08; 
                particleDuration = 800;
                effectPos = targetEffectPos || effectPos;
                break;
            case 'quake_stomp':
                particleColor = event.color || 0xA0522D; 
                particleCount = 100;
                particleSize = 0.12;
                particleDuration = 1500;
                effectPos = playerMeshRef.current?.position.clone() || effectPos; 
                break;
            case 'battle_trance_as':
            case 'battle_trance_ms':
                 particleColor = event.color || 0x00FFFF; 
                 particleCount = 60;
                 particleSize = 0.08;
                 particleDuration = 1200;
                 break;
            case 'thorns_aura':
                particleColor = event.color || 0xff0000; 
                particleCount = 20;
                particleSize = 0.07;
                particleSpeed = 0.08; 
                const attackerMesh = monsterMeshesRef.current.get(event.targetId!);
                if (attackerMesh) targetEffectPos = attackerMesh.position.clone();
                break;
            case 'lethal_tempo':
                 particleColor = event.color || 0xFF8C00; 
                 particleCount = 70;
                 particleSize = 0.1;
                 particleDuration = 800;
                 particleSpeed = 0.09;
                 break;
            case 'fortune_favors':
                 particleColor = event.color || 0xFFD700; 
                 particleCount = 25;
                 particleSize = 0.08;
                 break;
            default:
                break;
        }

        if (effectPos && sceneRef.current) { 
            createParticleEffect(sceneRef.current, event.skillId, effectPos, targetEffectPos, particleColor, particleCount, particleSize, particleDuration, particleSpeed);
        }
        processedSkillProcEventIdsRef.current.add(event.id);
    });

    const currentSkillProcEventIdsInProp = new Set(skillProcEvents.map(e => e.id));
    processedSkillProcEventIdsRef.current.forEach(id => {
        if (!currentSkillProcEventIdsInProp.has(id)) {
            processedSkillProcEventIdsRef.current.delete(id);
        }
    });

   }, [skillProcEvents]);


  return (
    <div className="relative w-full h-full border-2 border-transparent shadow-xl rounded-lg overflow-hidden">
      <h4 className="absolute top-1 left-2 text-xs text-gray-400 font-semibold pointer-events-none z-10">미니맵</h4>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {cameraPositionDisplay && (
        <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs p-1.5 rounded-md shadow pointer-events-none z-10">
          <p>X: {cameraPositionDisplay.x.toFixed(1)}</p>
          <p>Y: {cameraPositionDisplay.y.toFixed(1)}</p>
          <p>Z: {cameraPositionDisplay.z.toFixed(1)}</p>
        </div>
      )}
    </div>
  );
};

export default Minimap;
