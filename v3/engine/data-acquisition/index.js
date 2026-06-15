/**
 * Data Acquisition Engine — exports
 */
module.exports = {
  BaseAdapter: require('./BaseAdapter'),
  FusionCore: require('./FusionCore'),
  InferenceEngine: require('./InferenceEngine'),
  DataPipeline: require('./DataPipeline'),
  FeedbackEngine: require('./FeedbackEngine'),

  adapters: {
    GastatAdapter: require('./adapters/GastatAdapter'),
    SamaAdapter: require('./adapters/SamaAdapter'),
    ManualAdapter: require('./adapters/ManualAdapter'),
    LLMEstimationAdapter: require('./adapters/LLMEstimationAdapter')
  },

  engines: {
    CityEngine: require('./engines/CityEngine'),
    RealEstateEngine: require('./engines/RealEstateEngine'),
    LaborEngine: require('./engines/LaborEngine'),
    CompetitionEngine: require('./engines/CompetitionEngine'),
    MarketEngine: require('./engines/MarketEngine'),
    PricingEngine: require('./engines/PricingEngine')
  }
};
