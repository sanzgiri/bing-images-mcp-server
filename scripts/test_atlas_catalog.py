import unittest

from atlas_archive import ArchiveParser, merge_sources
from atlas_geocode import resolve_title

class ArchiveTests(unittest.TestCase):
    def test_original_dates_and_aliases_survive_deduplication(self):
        parser = ArchiveParser(2020)
        parser.feed('<a href="/bing/1"><img data-src="https://img.peapix.com/one_640.jpg"></a><a href="/bing/1">Lake, Italy</a><span class="fs-sm">February 29</span>')
        self.assertEqual(parser.records["/bing/1"]["date"], "2020-02-29")
        self.assertEqual(parser.records["/bing/1"]["imageURL"], "https://img.peapix.com/one.jpg")
        a = dict(title="Lake, Italy", date="2020-02-29", edition="us", imageURL="https://img.peapix.com/one.jpg", pageURL="https://peapix.com/bing/1")
        b = dict(a, title="Another caption, Italy", date="2020-03-01", edition="gb")
        merged = merge_sources([], [a, b])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["date"], "2020-03-01")
        self.assertEqual(len(merged[0]["archiveTitles"]), 2)
        self.assertEqual(merge_sources(merged, []), merged)

class GeocodingTests(unittest.TestCase):
    countries = {"FR": dict(name="France", latitude=46.6, longitude=2.4, geonameID="FR"), "US": dict(name="United States", latitude=39, longitude=-98, geonameID="US")}
    aliases = {"france": {"FR"}, "usa": {"US"}, "us": {"US"}}

    @staticmethod
    def record(id, name, lat, lon, population=0, code="US", admin="", feature="PPL"):
        return dict(id=id, name=name, latitude=lat, longitude=lon, population=population, countryCode=code, admin1=admin, featureClass="P", featureCode=feature)

    def test_country_name_does_not_pick_a_village_with_the_same_name(self):
        index = {"france": [self.record("village", "France", 45.6, -.8, code="FR")]}
        result = resolve_title("European hedgehog, France", index, self.countries, self.aliases, {})
        self.assertEqual(result["precision"], "country")
        self.assertEqual(result["latitude"], 46.6)

    def test_ambiguous_city_is_not_resolved_by_population_alone(self):
        index = {"springfield": [self.record("one", "Springfield", 40, -90, population=110000), self.record("two", "Springfield", 44, -123, population=80000)]}
        result = resolve_title("Springfield, USA", index, self.countries, self.aliases, {})
        self.assertEqual(result["precision"], "country")

    def test_region_context_disambiguates_city(self):
        index = {"springfield": [self.record("one", "Springfield", 40, -90, population=110000, admin="IL"), self.record("two", "Springfield", 44, -123, population=80000, admin="OR")]}
        result = resolve_title("Springfield, Illinois, USA", index, self.countries, self.aliases, {"illinois": {("US", "IL")}})
        self.assertEqual(result["geonameID"], "one")

    def test_space_photo_is_not_given_an_earth_pin(self):
        index = {"saturn": [self.record("village", "Saturn", 40, -90, population=900000)]}
        self.assertIsNone(resolve_title("The rings of Saturn", index, self.countries, self.aliases, {}))

if __name__ == "__main__":
    unittest.main()
