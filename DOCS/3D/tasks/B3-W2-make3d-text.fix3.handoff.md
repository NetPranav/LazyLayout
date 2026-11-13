# Task Fix3 Handoff: B3-W2-make3d-text
1. Detected interior chords where both endpoints lie on the rim (z = 0) and are shared by two front surface triangles across thin polygon spikes.
2. Inserted chord midpoints elevated to z = +e (e = max(0.05 * depth, sdfHeight)) on the front and split each sharing triangle pair into four conforming triangles.
3. Generated the back surface as a mirrored copy with negated z and reversed winding so midpoints have z = -e, ensuring former chords are unshared between surfaces.
4. Retained the rim-only flat triangle filter before welding; all edges now have count = 2, making the 5-pointed star and all reference shapes 100% watertight.
