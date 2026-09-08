# Editable IQON precision detail — Blender 5.2
# Run: blender --background --python create-precision-scene.py
# Optional: set IQON_OUTPUT_DIR to choose the output directory.
import os
from pathlib import Path
output_dir=Path(os.environ.get('IQON_OUTPUT_DIR',str(Path(__file__).resolve().parent)))
output_dir.mkdir(parents=True,exist_ok=True)
if 'artifacts' not in globals():
    class LocalArtifact:
        def __init__(self,name): self.path=str(output_dir/name)
        def publish(self): print('Saved image:',self.path)
    class LocalArtifacts:
        def file(self,name,media_type): return LocalArtifact(name)
    artifacts=LocalArtifacts()

import bpy, math
from mathutils import Vector
scene = bpy.context.scene
initial_objects = [{"name": o.name, "type": o.type} for o in scene.objects]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

def material(name, color, metallic=0, roughness=0.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    return m, p

steel, p = material('Silver | finely machined satin steel', (.48,.52,.56), 1, .26)
for n in ['Anisotropic IOR Level', 'Anisotropic']:
    if n in p.inputs: p.inputs[n].default_value = .58
nodes = steel.node_tree.nodes
links = steel.node_tree.links
tex = nodes.new('ShaderNodeTexCoord')
wave = nodes.new('ShaderNodeTexWave')
wave.wave_type = 'RINGS'
wave.rings_direction = 'Z'
wave.inputs['Scale'].default_value = 195
wave.inputs['Distortion'].default_value = .3
wave.inputs['Detail'].default_value = 2
links.new(tex.outputs['Generated'], wave.inputs['Vector'])
bump = nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = .15
bump.inputs['Distance'].default_value = .000016
links.new(wave.outputs['Fac'], bump.inputs['Height'])
links.new(bump.outputs['Normal'], p.inputs['Normal'])
dark, _ = material('Charcoal | optical studio surface', (.009,.012,.016), .25, .39)
groove, _ = material('Dark metal | precise circumferential inlay', (.033,.042,.05), 1, .24)

bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=.065, depth=.0038, location=(0,0,.0019))
disc=bpy.context.object
disc.name='Machined silver surface | 130 mm diameter'
disc.data.materials.append(steel)
bev=disc.modifiers.new('Submillimetre edge radius', 'BEVEL')
bev.width=.00045
bev.segments=4
disc.modifiers.new('Weighted precision normals','WEIGHTED_NORMAL')
for poly in disc.data.polygons: poly.use_smooth=True
# Two narrow concentric tooling details close to the bevel
for i, radius in enumerate([.0595,.062]):
    bpy.ops.mesh.primitive_torus_add(major_segments=256, minor_segments=8, location=(0,0,.00382), major_radius=radius, minor_radius=.000055)
    ob=bpy.context.object
    ob.name='Precision engraved circle '+str(i+1)
    ob.scale.z=.26
    ob.data.materials.append(groove)
    for f in ob.data.polygons: f.use_smooth=True

glass, gp=material('Serum | clear physical dielectric', (.965,.99,1), 0, .038)
for n in ['Transmission Weight','Transmission']:
    if n in gp.inputs: gp.inputs[n].default_value=1
gp.inputs['IOR'].default_value=1.38
if 'Coat Weight' in gp.inputs: gp.inputs['Coat Weight'].default_value=.12
if 'Coat Roughness' in gp.inputs: gp.inputs['Coat Roughness'].default_value=.04
# Editable radial profile with a broad contact line and smooth spherical crown.
radial_segments=128
profile_segments=64
radius=.0135
height=.013
verts=[(0,0,height)]
faces=[]
for j in range(1,profile_segments+1):
    t=(j/profile_segments)*math.pi/2
    r=radius*math.sin(t)
    z=height*math.cos(t)
    for k in range(radial_segments):
        a=2*math.pi*k/radial_segments
        verts.append((r*math.cos(a),r*math.sin(a),z))
for k in range(radial_segments):
    faces.append((0,1+k,1+(k+1)%radial_segments))
for j in range(profile_segments-1):
    a0=1+j*radial_segments
    b0=a0+radial_segments
    for k in range(radial_segments):
        kn=(k+1)%radial_segments
        faces.append((a0+k,b0+k,b0+kn,a0+kn))
bottom=len(verts)
verts.append((0,0,0))
start=1+(profile_segments-1)*radial_segments
for k in range(radial_segments):
    faces.append((bottom,start+(k+1)%radial_segments,start+k))
mesh=bpy.data.meshes.new('Serum drop | radial surface tension profile')
mesh.from_pydata(verts,[],faces)
mesh.update()
drop=bpy.data.objects.new('One serum droplet | 27 mm contact diameter',mesh)
scene.collection.objects.link(drop)
drop.location=(.012,.002,.00386)
drop.data.materials.append(glass)
for f in mesh.polygons: f.use_smooth=True
sub=drop.modifiers.new('Smooth surface tension', 'SUBSURF')
sub.levels=1
sub.render_levels=1

bpy.ops.mesh.primitive_plane_add(size=.6, location=(0,0,-.00004))
floor=bpy.context.object
floor.name='Continuous charcoal studio'
floor.data.materials.append(dark)

def point_at(obj, xyz):
    obj.rotation_euler=(Vector(xyz)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name, location, power, size, target, color=(1,1,1), size_y=None):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='RECTANGLE'
    data.size=size
    data.size_y=size_y or size
    data.color=color
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    point_at(obj,target)
    return obj
area('Key | long cool softbox',(-.04,-.055,.12),20,.085,(.006,0,0),(0.91,.95,1),.028)
area('Rim | precision vertical strip',(.075,.048,.07),18,.062,(.015,.002,.009),(0.91,.96,1),.012)
area('Fill | controlled frontal bounce',(-.07,-.13,.06),4,.055,(0,0,0),(1,1,1),.08)
area('Glint | narrow rear silver edge',(-.075,.06,.05),7,.075,(0,0,.005),(1,1,1),.009)
world=bpy.data.worlds.new('Charcoal ambient') if not scene.world else scene.world
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.032,.045,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.2

bpy.ops.object.camera_add(location=(.105,-.146,.143))
camera=bpy.context.object
camera.name='Delivery camera | 70 mm macro'
point_at(camera,(.003,.008,.006))
camera.data.lens=70
camera.data.sensor_width=36
camera.data.dof.use_dof=True
camera.data.dof.focus_object=drop
camera.data.dof.aperture_fstop=11
camera.data.clip_start=.001
camera.data.clip_end=1000
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transmission_bounces=8
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE'
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=False
try: scene.view_settings.view_transform='AgX'
except: pass
scene.view_settings.exposure=-.5
scene.render.fps=24
scene.frame_start=1
scene.frame_end=1

scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=8
scene.cycles.use_adaptive_sampling=False
scene.cycles.use_denoising=True
scene.cycles.denoiser='OPENIMAGEDENOISE'
scene.cycles.max_bounces=6
scene.cycles.transmission_bounces=4
scene.cycles.glossy_bounces=4
scene.render.threads_mode='FIXED'
scene.render.threads=4
bpy.ops.wm.save_as_mainfile(filepath=str(output_dir/'iqon-precision-detail.blend'))
target=artifacts.file(name='iqon-precision-detail.png',media_type='image/png')
scene.render.filepath=target.path
bpy.ops.render.render(write_still=True)
target.publish()
