import osmium
import csv

ALLOWED_HIGHWAYS = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "residential"
}

class HighwayCSVHandler(osmium.SimpleHandler):
    def __init__(self, writer):
        super().__init__()
        self.writer = writer

    def way(self, w):
        highway = w.tags.get("highway")
        if highway not in ALLOWED_HIGHWAYS:
            return

        name = w.tags.get("name", "")
        ref = w.tags.get("ref", "")

        for n in w.nodes:
            if n.location.valid():
                self.writer.writerow([
                    w.id,
                    highway,
                    name,
                    ref,
                    n.location.lat,
                    n.location.lon
                ])

def main():
    with open("map_central_zone.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "way_id",
            "highway_type",
            "name",
            "ref",
            "lat",
            "lon"
        ])

        handler = HighwayCSVHandler(writer)
        handler.apply_file(
            "../central-zone-260129.osm.pbf",
            locations=True
        )

if __name__ == "__main__":
    main()
