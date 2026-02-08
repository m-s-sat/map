import cppEngine from "./cpp-engine.service";

class RouteService {

  public async getRoute(source: number, destination: number) {

    const result = await cppEngine.query(source, destination);

    if (!result) {
      return null;
    }

    return result;
  }
}

export default new RouteService();
