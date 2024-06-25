(function () {
  "use strict";

  const UPDATES_PER_MINUTE = 2;
  const UPDATES_PER_HOUR = UPDATES_PER_MINUTE * 60;
  const UPDATES_PER_DAY = UPDATES_PER_HOUR * 24;

  /** the current pet version.. */
  const CURRENT_PET_VERSION = 1;
  /** the max food a pet will eat */
  const MAX_FOOD = 100;
  /** the amount of time it takes for a pet to have to GO */
  const POTTY_TIME = 100;
  /** how fast a pet's food value decays */
  const FOOD_DECAY = MAX_FOOD / (UPDATES_PER_HOUR * 8); // to stay on top should be fed roughly once every 8 hours?
  /** the rate at which a pet ages */
  const AGING_RATE = 1;
  /** how fast a pet's potty need decays */
  const POTTY_DECAY = FOOD_DECAY / 2; // roughly every 4 hours?
  /** how much mess can be in a pet's space at once */
  const MAX_MESS = 5;
  /** how fast a pet's happiness decays */
  const HAPPINESS_DECAY = FOOD_DECAY;
  /** a pet's maximum happiness */
  const MAX_HAPPINESS = 100;
  /** how quickly a pet's happiness will be reduced by when hungry */
  const HAPPINESS_EMPTY_STOMACH_MODIFIER = -10 / UPDATES_PER_HOUR;
  /** how quickly a pet's happiness will be reduced by when their space is messy, per piece of mess */
  const HAPPINESS_MESS_MODIFIER = -5 / UPDATES_PER_HOUR;

  /** the amount of happiness gained when the pet is fed (excluding when the pet doesn't yet need food) */
  const FEED_HAPPINESS = 5;
  /** the amount of happiness gained when the pet is pet */
  const PET_HAPPINESS = 20;
  /** the amount of happiness gained when the pet's space is cleaned */
  const CLEAN_HAPPINESS = 1;

  /** the minimum amount of time between feedings */
  const FEED_TIMER = 5000;
  /** the minimum amount of time between pets */
  const PET_TIMER = 2000;
  /** the minimum amount of time between cleans */
  const CLEAN_TIMER = 5000;

  const PET_SAVE_KEY = "pet-game";

  /** life stage for an egg */
  const LIFE_STAGE_EGG = 1;
  /** life stage for a pup */
  const LIFE_STAGE_PUP = 2;
  /** life stage for an adult */
  const LIFE_STAGE_ADULT = 3;
  /** life stage for an elder pet */
  const LIFE_STAGE_ELDER = 4;
  /** the time it takes for a pet to grow past the egg phase */
  const EGG_TIME = UPDATES_PER_MINUTE;
  /** the time it takes for a pet to grow past the pup phase */
  const PUP_TIME = UPDATES_PER_DAY * 7;
  /** the time it takes for a pet to grow past the adult phase */
  const ADULT_TIME = UPDATES_PER_DAY * 15;
  /** the time it takes for a pet to grow past the elder phase */
  const ELDER_TIME = UPDATES_PER_DAY * 7;

  const petDisplay = document.querySelector("#pet-display");
  const petName = document.querySelectorAll(".pet-name");
  const eggDiv = document.querySelector("div#egg");
  const petSetup = document.querySelector("#pet-setup");
  const adultInfo = document.querySelector("div#adult-info");
  const elderInfo = document.querySelector("div#elder-info");
  const passedAwayInfo = document.querySelector("div#passed-away-info");
  const name = petSetup.querySelector("input[name=pet-name]");
  const nameItButton = petSetup.querySelector("button");

  const petActions = document.querySelector("div#pet-actions");
  const pauseButton = petActions.querySelector("button[name=pause]");
  const hatchedActions = petActions.querySelector("div[name=hatched-actions]");
  const feedButton = hatchedActions.querySelector("button[name=feed]");
  const petButton = hatchedActions.querySelector("button[name=pet]");
  const cleanButton = hatchedActions.querySelector("button[name=clean]");

  const debug = document.querySelector("div#debug-section");
  const debugLifeStage = debug.querySelector("span[name=ls]");
  const debugAge = debug.querySelector("span[name=a]");
  const debugFood = debug.querySelector("span[name=f]");
  const debugBehavior = debug.querySelector("span[name=b]");
  const debugPotty = debug.querySelector("span[name=p]");
  const debugMessCounter = debug.querySelector("span[name=mc]");
  const debugHappiness = debug.querySelector("span[name=h]");
  const forceUpdateButton = debug.querySelector("button#force-update");
  const resetButton = debug.querySelector("button#reset");

  let canFeed = true;
  let canPet = true;
  let canClean = true;

  /**
   * class containing information about a pet
   */
  class Pet {
    /** current pet version */
    version = CURRENT_PET_VERSION;
    /** whether the pet can die or not */
    canDie = false;
    /** whether the pet is alive or dead */
    alive = true;
    /** whether the pet simulation is paused */
    paused = false;
    /** whether the pet simulation needs an interactive advancement */
    needsAdvancement = false;
    /** the pet's current life stage */
    lifeStage = LIFE_STAGE_EGG;
    /** the pet's name */
    name = "";
    /** how much food the pet has stored */
    food = MAX_FOOD;
    /** the pet's age */
    age = 0;
    /** the pet's behavior score */
    behavior = 0;
    /** how long until the pet needs to go potty */
    pottyTimer = POTTY_TIME;
    /** how much mess the pet has made */
    messCounter = 0;
    /** the pet's current happiness */
    _happiness = MAX_HAPPINESS;
    /** the time the pet was last updated */
    lastUpdate = Date.now();
    /** the time the egg was found */
    eggFound = Date.now();
    /** the time the egg hatched */
    hatched = Date.now();

    /**
     * updates a pet
     */
    update() {
      if (!this.alive || this.paused || this.needsAdvancement) {
        return;
      }
      console.log("update");

      this.lastUpdate = Date.now();
      this.age += AGING_RATE;

      if (this.lifeStage !== LIFE_STAGE_EGG) {
        this.food -= FOOD_DECAY;
        this.pottyTimer -= POTTY_DECAY;
        this.happiness -= HAPPINESS_DECAY;

        if (this.food < 0) {
          this.happiness += HAPPINESS_EMPTY_STOMACH_MODIFIER;
          this.food = 0;
          if (this.canDie) {
            // TODO: pet dies
          }
        }

        if (this.pottyTimer < 0) {
          this.goPotty();
        }
        for (let i = 0; i < this.messCounter; i++) {
          this.happiness += HAPPINESS_MESS_MODIFIER;
        }
      }

      if (this.lifeStage === LIFE_STAGE_EGG && this.age >= EGG_TIME) {
        this.needsAdvancement = true;
        this.lifeStage = LIFE_STAGE_PUP;
        this.age = 0;
      } else if (this.lifeStage === LIFE_STAGE_PUP && this.age >= PUP_TIME) {
        this.needsAdvancement = true;
        this.lifeStage = LIFE_STAGE_ADULT;
        this.age = 0;
      } else if (
        this.lifeStage === LIFE_STAGE_ADULT &&
        this.age >= ADULT_TIME
      ) {
        this.needsAdvancement = true;
        this.lifeStage = LIFE_STAGE_ELDER;
        this.age = 0;
      } else if (
        this.lifeStage === LIFE_STAGE_ELDER &&
        this.age >= ELDER_TIME
      ) {
        this.needsAdvancement = true;
        this.alive = false;
        // TODO: DEATH
      }
      this.updateDom();
    }

    /**
     * updates the html dom
     */
    updateDom() {
      eggDiv.classList.add("hidden");
      petSetup.classList.add("hidden");
      hatchedActions.classList.remove("hidden");

      if (this.lifeStage === LIFE_STAGE_EGG) {
        eggDiv.classList.remove("hidden");
        hatchedActions.classList.add("hidden");
      } else if (this.lifeStage === LIFE_STAGE_PUP) {
        if (this.needsAdvancement) {
          petSetup.classList.remove("hidden");
        }
      } else if (this.lifeStage === LIFE_STAGE_ADULT) {
        if (this.needsAdvancement) {
          adultInfo.classList.remove("hidden");
        }
      } else if (this.lifeStage === LIFE_STAGE_ELDER) {
        if (this.needsAdvancement) {
          if (this.alive) {
            elderInfo.classList.remove("hidden");
          } else {
            passedAwayInfo.classList.remove("hidden");
          }
        }
      }

      debugLifeStage.innerText = this.lifeStage;
      debugAge.innerText = this.age;
      debugFood.innerText = this.food;
      debugBehavior.innerText = this.behavior;
      debugPotty.innerText = this.pottyTimer;
      debugMessCounter.innerText = this.messCounter;
      debugHappiness.innerText = this.happiness;

      this.save();
    }

    /**
     * feeds the pet
     * @param {number} amount the amount to feed the pet by
     */
    feed(amount) {
      if (this.food > MAX_FOOD) {
        return;
      }
      this.food += amount;
      if (this.food <= MAX_FOOD) {
        this.happiness += FEED_HAPPINESS;
      }
      this.updateDom();
    }

    /**
     * makes the pet go potty
     */
    goPotty() {
      if (this.behavior > 15) {
        // go potty properly
      } else {
        this.messCounter += 1;
        if (this.messCounter > MAX_MESS) {
          this.messCounter = MAX_MESS;
        }
      }
      this.pottyTimer = POTTY_TIME;
      pet.updateDom();
    }

    /**
     * pets the pet
     */
    pet() {
      this.behavior += 0.5;
      this.happiness += PET_HAPPINESS;
      pet.updateDom();
    }

    /**
     * cleans the pet's space
     */
    clean() {
      if (this.messCounter > 0) {
        this.messCounter -= 1;
        this.happiness += CLEAN_HAPPINESS;
      } else {
        this.behavior += 1;
        this.happiness -= CLEAN_HAPPINESS;
      }
      pet.updateDom();
    }

    /**
     * saves the pet
     */
    save() {
      localStorage.setItem(PET_SAVE_KEY, JSON.stringify(this));
    }

    /**
     * loads the pet
     */
    load() {
      const item = localStorage.getItem(PET_SAVE_KEY);
      if (item != undefined) {
        const loaded = JSON.parse(localStorage.getItem(PET_SAVE_KEY));
        for (let k of Object.keys(loaded)) {
          this[k] = loaded[k];
        }
        this.version = CURRENT_PET_VERSION;
        this.updateDom();
      }
    }

    /** whether the pet can be updated */
    get canUpdate() {
      return !this.paused && !this.needsAdvancement;
    }

    /** the pet's happiness */
    get happiness() {
      return this._happiness;
    }

    set happiness(amount) {
      if (amount < 0) {
        amount = 0;
      } else if (amount > MAX_HAPPINESS) {
        amount = MAX_HAPPINESS;
      }
      this._happiness = amount;
    }
  }

  let pet = new Pet();

  petSetup.addEventListener("submit", (e) => {
    e.preventDefault();
    const newName = name.value;
    if (newName.trim().length === 0) {
      return;
    }
    pet.name = newName;
    for (let name of petName) {
      name.innerText = pet.name;
    }
    pet.hatched = Date.now();
    pet.needsAdvancement = false;
    pet.updateDom();
  });

  feedButton.addEventListener("click", () => {
    if (!canFeed || !pet.canUpdate) {
      return;
    }
    canFeed = false;
    setTimeout(() => {
      canFeed = true;
    }, FEED_TIMER);

    pet.feed(38);
  });

  petButton.addEventListener("click", () => {
    if (!canPet || !pet.canUpdate) {
      return;
    }
    canPet = false;
    setTimeout(() => {
      canPet = true;
    }, PET_TIMER);

    pet.pet();
  });

  cleanButton.addEventListener("click", () => {
    if (!canClean || !pet.canUpdate) {
      return;
    }
    canClean = false;
    setTimeout(() => {
      canClean = true;
    }, CLEAN_TIMER);

    pet.clean();
  });

  const advance = () => {
    pet.needsAdvancement = false;
    pet.updateDom();
  };
  for (let btn of document.querySelectorAll("button.advancement")) {
    btn.addEventListener("click", advance);
  }

  passedAwayInfo.querySelector("button").addEventListener("click", () => {
    pet = new Pet();
    pet.updateDom();
  });

  const update = () => {
    pet.update();
  };

  setInterval(update, 60000 / UPDATES_PER_MINUTE);

  forceUpdateButton.addEventListener("click", update);
  resetButton.addEventListener("click", () => {
    pet = new Pet();
    pet.updateDom();
  });

  pet.load();

  for (let name of petName) {
    name.innerText = pet.name;
  }

  if (document.body.classList.contains("debug")) {
    debug.classList.remove("hidden");
  }

  pet.updateDom();

  console.log(pet);
})();
