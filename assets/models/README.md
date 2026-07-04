# Character model drop-in folder

The game ships with original placeholder figures only. This folder is where properly
licensed 3D character models go. Only place files here if you actually hold the rights
to use them in this project.

## How it works

At runtime the game looks for a `.glb` file for every named character. If the file
exists it is loaded, auto scaled to the character's height, given a ground shadow,
and its first animation clip is played. The placeholder figure is hidden. If the file
is missing the placeholder is used and nothing breaks.

## Naming convention

Lowercase letters and digits only, taken from the character's display name, plus `.glb`.

Examples:

```
mario.glb        luigi.glb        peach.glb        daisy.glb       toad.glb
toadette.glb     yoshi.glb        rosalina.glb     pauline.glb     toadsworth.glb
birdo.glb        donkeykong.glb   diddykong.glb    crankykong.glb  cappy.glb
bowser.glb       bowserjr.glb     wario.glb        waluigi.glb     kingboo.glb
kamek.glb        larry.glb        morton.glb       wendy.glb       iggy.glb
roy.glb          lemmy.glb        ludwig.glb       shyguy.glb      goomba.glb
koopatroopa.glb  peteypiranha.glb kingbobomb.glb   fawful.glb      nabbit.glb
foremanspike.glb boo.glb
pikachu.glb      eevee.glb        charizard.glb    mewtwo.glb      lucario.glb
gengar.glb       greninja.glb     umbreon.glb      garchomp.glb    rayquaza.glb
arceus.glb       mew.glb          snorlax.glb      tyranitar.glb   dragonite.glb
metagross.glb    gardevoir.glb    groudon.glb      kyogre.glb
bulbasaur.glb    squirtle.glb     charmander.glb   meowth.glb      jigglypuff.glb
raichu.glb       psyduck.glb      clefairy.glb     piplup.glb
```

Keep meshes lightweight (a few thousand triangles) so mobile stays smooth.
