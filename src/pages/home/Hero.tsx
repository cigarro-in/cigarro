import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';

interface HeroSlide {
  id: string;
  title: string;
  suptitle?: string;
  description?: string;
  image_url: string;
  mobile_image_url?: string;
  small_image_url?: string;
  button_text?: string;
  button_url?: string;
  product_name?: string;
  product_price?: string;
  product_image_url?: string;
  is_active: boolean;
  sort_order: number;
}

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHeroSlides();
  }, []);

  const loadHeroSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error loading hero slides:', error);
      // No fallback - show empty state if database fails
      setSlides([]);
    } finally {
      setIsLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const currentSlideData = slides[currentSlide];

  if (isLoading) {
    return (
      <div className="pt-[var(--gutter)] pb-[var(--gutter)] relative min-h-[100dvh] flex items-center overflow-hidden">
        <div className="main-container h-full relative z-10">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          </div>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="py-0 md:py-[2rem]">
      <div className="main-container">
        <div className="relative w-full aspect-video rounded-[0.75rem] md:rounded-[1rem] overflow-hidden shadow-2xl">
          <div className="absolute inset-0">
            <div className="relative h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full" id={`header-slider__slide-${currentSlide}`}>
                
                {/* Big Image */}
                <div className="relative bg-transparent overflow-hidden h-full">
                  <img 
                    className="hidden md:block w-full h-full object-cover object-center" 
                    src={currentSlideData.image_url} 
                    alt={`Slide ${currentSlide + 1}`}
                    width="1440" 
                    height="1491"
                  />
                  <img 
                    className="block md:hidden w-full h-full object-cover object-center" 
                    src={currentSlideData.mobile_image_url || currentSlideData.image_url} 
                    alt={`Slide ${currentSlide + 1}`}
                  />
                  
                  {/* Mobile Overlay Gradient */}
                  <div className="md:hidden absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                  
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
              <div className="absolute bottom-[1rem] left-1/2 transform -translate-x-1/2 flex space-x-[0.75rem] z-10">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-[0.75rem] rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-[2rem] bg-dark shadow-lg' 
                      : 'w-[0.75rem] bg-dark/40 hover:bg-dark/70 hover:scale-110'
                  }`}
                />
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
