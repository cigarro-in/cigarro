import { useState, useEffect, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeroSlide } from '../../types/home';

interface HeroProps {
  slides?: HeroSlide[];
  isLoading?: boolean;
  autoPlayInterval?: number;
}

const AUTO_PLAY_INTERVAL = 5000; // 5 seconds

const Hero = memo(function Hero({ 
  slides = [], 
  isLoading = false,
  autoPlayInterval = AUTO_PLAY_INTERVAL 
}: HeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slideCount = slides.length;

  const nextSlide = useCallback(() => {
    if (slideCount === 0) return;
    setCurrentSlide((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const prevSlide = useCallback(() => {
    if (slideCount === 0) return;
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (slideCount <= 1 || isPaused) return;
    
    const timer = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(timer);
  }, [slideCount, isPaused, nextSlide, autoPlayInterval]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Loading state - reserve space for LCP stability
  if (isLoading || slideCount === 0) {
    return (
      <section className="py-0 md:py-8" aria-label="Hero carousel loading">
        <div className="main-container">
          <div className="relative w-full aspect-video rounded-xl md:rounded-2xl bg-creme-light/50 animate-pulse" />
        </div>
      </section>
    );
  }

  const currentSlideData = slides[currentSlide];
  if (!currentSlideData) return null;

  return (
    <section 
      className="py-0 md:py-8"
      aria-label="Hero carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="main-container">
        <div className="relative w-full aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
          <div className="absolute inset-0">
            <div className="relative h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full" id={`header-slider__slide-${currentSlide}`}>
                
                {/* Responsive Image Handling */}
                <div className="relative bg-transparent overflow-hidden h-full w-full">
                  <picture className="w-full h-full block">
                    {/* Desktop Image */}
                    <source 
                      media="(min-width: 768px)" 
                      srcSet={currentSlideData.image_url} 
                    />
                    {/* Mobile Image */}
                    <img 
                      className="w-full h-full object-cover object-center"
                      src={currentSlideData.mobile_image_url || currentSlideData.image_url}
                      alt={currentSlideData.title || `Slide ${currentSlide + 1}`}
                      width="1440" 
                      height="810"
                      // LCP Optimization
                      fetchpriority="high"
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                  
                  {/* Mobile Overlay Gradient */}
                  <div className="md:hidden absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                  
                  {/* Mobile Text Overlay */}
                  <div className="md:hidden absolute inset-0 flex flex-col justify-end p-[1.5rem] pb-[2rem]">
                      {currentSlideData.suptitle && (
                        <p className="text-creme-light/90 text-xs uppercase tracking-wider mb-[0.5rem] font-medium">
                          {currentSlideData.suptitle}
                        </p>
                      )}
                      <h2 className="text-creme-light font-serif text-2xl leading-tight mb-[1rem] max-w-[85%]">
                        {currentSlideData.title}
                      </h2>
                      {currentSlideData.button_text && currentSlideData.button_url && (
                        <a
                          href={currentSlideData.button_url}
                          className="inline-flex items-center justify-center bg-dark text-creme-light hover:bg-canyon transition-all duration-300 font-medium text-sm uppercase tracking-wide px-[1.5rem] py-[0.75rem] rounded-full w-fit"
                          target="_self"
                        >
                          {currentSlideData.button_text}
                        </a>
                      )}
                  </div>

                  {/* Product Button (if exists) */}
                  {currentSlideData.product_name && currentSlideData.product_image_url && (
                    <div className="absolute bottom-[1rem] left-[1rem] bg-white rounded-[0.5rem] overflow-hidden max-w-[6.25rem] max-h-[6.25rem] md:max-w-[calc(100%-2rem)] md:max-h-[10.3125rem] whitespace-nowrap text-ellipsis transition-all duration-1000 ease-[cubic-bezier(0.33,1,0.68,1)] hover:max-w-[calc(100%-2rem)] hover:max-h-[10.3125rem] group">
                      <div className="box-border">
                        <div className="flex flex-nowrap items-center max-w-full">
                          <div className="block my-[0.625rem] mx-[0.625rem] min-w-[5rem] max-w-[5rem] aspect-square rounded-[0.5rem] overflow-hidden text-center">
                            <img 
                              className="w-full mx-auto object-cover aspect-square" 
                              src={currentSlideData.product_image_url} 
                              alt="" 
                              width="400" 
                              height="400"
                            />
                          </div>
                          <div className="my-[0.5rem] mr-[0.625rem] ml-0 max-w-[calc(100%-6.875rem)]">
                            <div className="block text-dark font-sans font-medium text-base lg:text-lg leading-tight tracking-tight mb-[0.125rem] overflow-hidden whitespace-nowrap text-ellipsis max-w-max">
                              {currentSlideData.product_name}
                            </div>
                            <div className="text-dark font-sans text-sm lg:text-base">
                              {currentSlideData.product_price}
                            </div>
                          </div>
                          <a 
                            href={`/product/${currentSlideData.product_name?.toLowerCase().replace(/\s+/g, '-')}`} 
                            className="hidden group-hover:block inline-block w-[2.5rem] aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden ml-auto mr-[0.625rem]"
                          >
                            <span className="inline-block w-full h-full relative -top-px -left-px transition-transform duration-500">
                              <ChevronRight className="w-[1rem] h-[1rem] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                            </span>
                          </a>
                        </div>
                        <div className="hidden group-hover:flex flex-nowrap text-center border-t border-coyote text-sm lg:text-base">
                          <a 
                            href={`/product/${currentSlideData.product_name?.toLowerCase().replace(/\s+/g, '-')}`}
                            className="flex-1 py-[1rem] px-[1.5rem] text-inherit text-sm leading-none w-1/2 cursor-pointer transition-all duration-500 hover:bg-creme-light"
                          >
                            Customize
                          </a>
                          <button 
                            type="button"
                            className="flex-1 py-[1rem] px-[1.5rem] text-inherit text-sm leading-none w-1/2 cursor-pointer transition-all duration-500 border-l border-coyote hover:bg-creme-light"
                          >
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Content - Desktop Only */}
                <div className="hidden lg:flex flex-col justify-center px-[2rem] lg:px-[3rem] h-full">
                  <div className="fade-in">
                    {currentSlideData.suptitle && (
                      <div className="suptitle text-canyon overflow-hidden w-full mb-[0.75rem] sm:mb-[1.25rem]">
                        <p className="suptitle text-sm sm:text-base lg:text-lg">{currentSlideData.suptitle}</p>
                      </div>
                    )}
                    <div className="mb-[1.5rem]">
                      <h2 className="medium-title w-full leading-tight text-3xl lg:text-4xl xl:text-5xl">{currentSlideData.title}</h2>
                    </div>
                    {currentSlideData.button_text && currentSlideData.button_url && (
                      <a
                        href={currentSlideData.button_url}
                        className="inline-block font-sans font-normal text-creme-light bg-dark border-none rounded-full text-center relative min-w-[5.625rem] no-underline overflow-hidden cursor-pointer uppercase tracking-wide text-sm leading-[1.71] px-[1.5rem] lg:px-[2rem] py-[0.75rem] lg:py-[1rem] transition-all duration-500 hover:bg-creme-light hover:text-dark"
                        target="_self"
                      >
                        <span className="block transition-transform duration-500">
                          {currentSlideData.button_text}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation Arrows */}
              <div className="hidden lg:flex absolute right-[1rem] top-1/2 -translate-y-1/2 z-10 space-x-[0.5rem]">
              <button 
                className="inline-block w-[2.5rem] lg:w-[3rem] aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden hover:bg-dark hover:text-white group"
                onClick={prevSlide}
                aria-label="Previous slide"
              >
                <span className="inline-block w-full h-full relative transition-transform duration-500 group-hover:translate-x-full">
                  <ChevronLeft className="w-[1.25rem] h-[1.25rem] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </span>
                <span className="inline-block w-full h-full absolute left-0 top-0 transition-transform duration-500 transform -translate-x-full group-hover:translate-x-0">
                  <ChevronLeft className="w-[1.25rem] h-[1.25rem] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" />
                </span>
              </button>
              <button 
                className="inline-block w-[2.5rem] lg:w-[3rem] aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden hover:bg-dark hover:text-white group"
                onClick={nextSlide}
                aria-label="Next slide"
              >
                <span className="inline-block w-full h-full relative transition-transform duration-500 group-hover:translate-x-full">
                  <ChevronRight className="w-[1.25rem] h-[1.25rem] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </span>
                <span className="inline-block w-full h-full absolute left-0 top-0 transition-transform duration-500 transform -translate-x-full group-hover:translate-x-0">
                  <ChevronRight className="w-[1.25rem] h-[1.25rem] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" />
                </span>
              </button>
              </div>

              {/* Slide Indicators */}
              <div 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-10"
                role="tablist"
                aria-label="Slide indicators"
              >
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    role="tab"
                    aria-selected={index === currentSlide}
                    aria-label={`Go to slide ${index + 1}`}
                    className={`h-3 rounded-full transition-all duration-300 ${
                      index === currentSlide 
                        ? 'w-8 bg-dark shadow-lg' 
                        : 'w-3 bg-dark/40 hover:bg-dark/70 hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default Hero;
