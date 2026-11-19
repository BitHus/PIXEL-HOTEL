// id|description ; order = sheet order (25 per sheet, 5 per row)
export const L = `branch_tavern|foaming beer mug
branch_kitchen|cooking pot with steam
branch_farm|green sprout
branch_fishing|fish hook with line
branch_mining|pickaxe
branch_dungeon|sword
branch_home|brass key
hearth|stone fireplace with flame
quick_feet|winged boot
steady_hands|open hand holding a level mug
keen_eye|eye
roomy_tavern|table with two stools
patient_guests|hourglass
wide_kegs|big oak keg with brass hoops
smooth_pour|tap pouring a stream into a mug
warm_welcome|open wooden door with warm glow
regulars_gem|blue gem in a mug
bustling_hall|three clinking mugs
quiet_corner|candle on a small table with crescent moon
tavern_legend|golden goblet with crown
quick_simmer|bubbling pot with speed lines
brew_sense|flask with swirl and sparkles
big_batch|stack of three bread loaves
hearty_food|roast chicken leg
extra_mug|mug with a plus sign
thrifty_cook|ladle with a coin
taste_sense|spoon with a heart
cellar_racks|wine rack with bottles
patient_cellar|dusty aged bottle with cobweb
twin_barrel|two small barrels side by side
hot_stove|iron stove with flames
master_kitchen|chef hat with a star
green_thumb|glove with a leaf
seed_keeper|seed pouch
strong_fist|clenched fist
bountiful|basket of vegetables
quick_splice|two seeds joined by lightning
long_arms|garden rake
lucky_sprout|four leaf clover
seed_lore|open book with a seed
big_garden|fenced garden plot with crops
orchard_keeper|apple tree
wild_splicer|purple two-headed flower
harvest_moon|moon over a wheat sheaf
patient|fishing bobber floating
wide_box|fishing net
reel_master|fishing reel
long_line|spool of fishing line
bait_saver|bait tin with a worm
calm_hands|hand holding a feather
sharp_eye|eye above water ripples
trophy_hunter|fish trophy plaque
deep_cast|hook sinking with bubbles
calm_waters|calm waves under a moon
big_game|giant fish
double_hook|two golden crossed hooks
strong_arm|flexed arm
lantern|iron lantern
ore_sense|ore chunk with sparkle
careful_step|boot above a cracked floor
sure_footing|spiked boot
double_strike|two crossed pickaxes
prospector|gold pan with nuggets
pack_mule|ore minecart
gem_eye|magnifying glass over a gem
blaster|dynamite stick
gem_cutter|cut diamond
deep_delver|ladder down into a dark hole
thick_skin|leather armor vest
satchel|leather satchel bag
sharp_edge|shining sword blade
quick_strike|dagger with speed lines
light_feet|feather
second_wind|heart with wind swirl
last_stand|cracked shield with a heart
parry|sword and shield clashing with sparks
treasure_sense|open treasure chest
brawler|spiked gauntlet
guardian|tower shield
bone_breaker|cracked skull
house_pride|small house with a flag
pack_lunch|wrapped lunch bundle
cat_friend|cat head
decorator|framed painting
deep_pockets|bulging belt pouch
wanderer_feet|footprints
quest_hand|scroll with exclamation mark
long_nap|bed with Zzz
book_worm|book with a worm
homebody|cozy slippers
wanderer|walking stick and compass
renowned_host|gift box with a star
fresh_tap|tap dripping a drop with an arrow
kitchen_garden|carrot and pot
worm_digger|worm in dirt
steady_grip|gloved hand gripping a pole
delver|helmet with a lamp
war_stories|rolled scroll with crossed swords
hearth_home|fireplace with a tiny house`.split('\n').map(l=>l.split('|'));
export function sheet(n){const s=L.slice(n*25,n*25+25);let p='';for(let r=0;r<5;r++)p+=`Row ${r+1}: `+s.slice(r*5,r*5+5).map(x=>x[1]).filter(Boolean).join(', ')+'. ';return {names:s.map(x=>x[0]),prompt:`Sprite sheet of ${s.length} separate small pixel art game icons in a 5 by 5 grid, each icon 32x32 pixels in its own cell with empty space around it, transparent background, one object per icon, front view, bold dark brown outline, warm cozy medieval tavern colours, light from top left, simple shapes, no text. ${p}`};}
