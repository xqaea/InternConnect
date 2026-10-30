# O*NET data notice

InternConnect uses the O*NET 31.0 Essential Skills, Transferable Skills, and Software Skills files to standardize exact skill-name matches. It also imports Occupation Data, Job Titles, Sample of Reported Titles, Knowledge, and Task Statements for occupation lookup and supporting context. The files are imported locally during setup and are not queried from O*NET while matching.

The O*NET 31.0 Database is provided by the U.S. Department of Labor, Employment and Training Administration under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This system includes and adapts data from the O*NET 31.0 Database. It uses the Element Name and Workplace Example fields for local exact-name normalization. O*NET is a registered trademark of USDOL/ETA.

Source: [O*NET Database downloads](https://www.onetcenter.org/database.html) and [database license](https://www.onetcenter.org/license_db.html).

Imported CSV files are preserved as supplied. Application changes include selecting and deduplicating vocabulary labels, searching title aliases, sorting importance ratings, and excluding suppressed/not-relevant ratings from occupation skill and knowledge responses. Occupation context does not change the raw cosine similarity or certify student skills.
