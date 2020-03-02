# DBLP and rankings 

It grabs DBLP and tries to find rankings (Core Ranks and Scimago)

## install

    npm i

## run

It needs two arguments: the target URL (from DBLP), the output file (CSV)

    node dblpExtractor.js url out


For example

    node dblpExtractor.js https://dblp.uni-trier.de/pers/b/Blanc_0001:Xavier.html xavier.csv


## patches

Some DBLP entries do not match Core or Scimago queries.

The patch.json file allows you to defines patches (between DBLP entry and Core/Scimago qeury).
